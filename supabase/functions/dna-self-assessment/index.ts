import { authenticate } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { background } from "../_shared/background.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";
import { SOURCE_WEIGHTS, type EvidenceDimension } from "../_shared/founderScoring.ts";
import { DNA_QUESTIONS, DNA_DIMENSIONS } from "../_shared/dnaQuestions.ts";
import { recomputeFounderDna } from "../_shared/dnaRecompute.ts";
import { recomputeMatchesForFounder } from "../_shared/matchRecompute.ts";

const FN = "dna-self-assessment";

function forbidden(user: { role: string | null; id: string }, founderId: string): Response | null {
  if (user.role !== "admin" && user.id !== founderId) return json({ error: "Forbidden" }, 403);
  return null;
}

// GET /functions/v1/dna-self-assessment/:founderId — question bank + whether
// this founder has already completed it (admin or self).
async function getAssessment(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const err = forbidden(user, params.founderId);
  if (err) return err;

  const rows = await query<{ dna_self_assessment_completed_at: string | null }>(
    "SELECT dna_self_assessment_completed_at FROM founder_profiles WHERE user_id = $1",
    [params.founderId],
  );
  return json({
    questions: DNA_QUESTIONS,
    completedAt: rows[0]?.dna_self_assessment_completed_at ?? null,
  });
}

type Answers = Partial<Record<EvidenceDimension, string[]>>;

function validateAnswers(answers: unknown): string | null {
  if (!answers || typeof answers !== "object") return "answers is required";
  const a = answers as Answers;
  for (const dim of DNA_DIMENSIONS) {
    const list = a[dim];
    const expected = DNA_QUESTIONS[dim];
    if (!Array.isArray(list) || list.length !== expected.length) {
      return `answers.${dim} must have ${expected.length} entries`;
    }
    for (const ans of list) {
      if (typeof ans !== "string" || !ans.trim()) return `answers.${dim} has an empty response`;
    }
  }
  return null;
}

interface DimensionEval {
  score: number;
  observation: string;
}

function buildPrompt(answers: Answers): string {
  const sections = DNA_DIMENSIONS.map((dim) => {
    const qas = DNA_QUESTIONS[dim]
      .map((q, i) => `Q: ${q}\nA: ${(answers[dim] as string[])[i]}`)
      .join("\n\n");
    return `## ${dim}\n${qas}`;
  }).join("\n\n");

  return `You are assessing a startup founder's self-reported answers to a behavioral questionnaire, one section per character dimension (execution, integrity, commitment, communication, conflict, resilience, ego, values).

For EACH of the 8 dimensions, read the 5 Q&A pairs and rate how strongly the ANSWERS (not just the topic) demonstrate that trait, on a 1-100 scale. Score based on specificity, concrete detail, and evidence of real behavior — vague, generic, or clearly rehearsed/inspirational answers with no specifics should score low-to-mid regardless of how positive they sound. Score 1-30 for weak/evasive/generic answers, 31-60 for plausible but thin answers, 61-85 for specific and credible answers, 86-100 only for exceptionally detailed, self-aware, and consistent answers across all 5 questions in that dimension.

Respond with ONLY a JSON object, no markdown fences, no commentary, in exactly this shape:
{
  "execution": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "integrity": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "commitment": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "communication": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "conflict": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "resilience": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "ego": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" },
  "values": { "score": <1-100 integer>, "observation": "<one sentence, <=25 words>" }
}

${sections}`;
}

function parseEvaluation(raw: string): Record<EvidenceDimension, DimensionEval> | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const out = {} as Record<EvidenceDimension, DimensionEval>;
  for (const dim of DNA_DIMENSIONS) {
    // deno-lint-ignore no-explicit-any
    const entry = (parsed as any)[dim];
    const score = Number(entry?.score);
    const observation = typeof entry?.observation === "string" ? entry.observation.slice(0, 300) : "";
    if (!Number.isFinite(score) || score < 1 || score > 100) return null;
    out[dim] = { score: Math.round(score), observation };
  }
  return out;
}

// POST /functions/v1/dna-self-assessment/:founderId — submit all 40 answers,
// evaluate once via Gemini, write one 'self' evidence row per dimension plus
// the raw responses for audit, and mark the assessment complete.
async function submitAssessment(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const err = forbidden(user, params.founderId);
  if (err) return err;

  if (!isGeminiConfigured()) return json({ error: "DNA scoring is not configured" }, 503);

  const body = await req.json().catch(() => ({}));
  const validationError = validateAnswers(body?.answers);
  if (validationError) return json({ error: validationError }, 400);
  const answers = body.answers as Answers;

  let evaluation: Record<EvidenceDimension, DimensionEval> | null;
  try {
    const raw = await generateText(buildPrompt(answers));
    evaluation = parseEvaluation(raw);
  } catch (e) {
    console.error("[dna-self-assessment] Gemini call failed", e);
    return json({ error: "DNA scoring failed — please try again" }, 502);
  }
  if (!evaluation) {
    console.error("[dna-self-assessment] Gemini returned unparseable output");
    return json({ error: "DNA scoring failed — please try again" }, 502);
  }

  const founderId = params.founderId;
  const weight = SOURCE_WEIGHTS.self;

  for (const dim of DNA_DIMENSIONS) {
    const questions = DNA_QUESTIONS[dim];
    const dimAnswers = answers[dim] as string[];
    for (let i = 0; i < questions.length; i++) {
      await query(
        `INSERT INTO dna_self_assessment_responses (founder_id, dimension, question_index, question, answer)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (founder_id, dimension, question_index)
         DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer, created_at = now()`,
        [founderId, dim, i + 1, questions[i], dimAnswers[i]],
      );
    }

    const { score, observation } = evaluation[dim];
    await query(
      `INSERT INTO evidence (founder_id, source_type, dimension, signal, score, observation, is_negative, weight)
       VALUES ($1, 'self', $2, 'DNA self-assessment', $3, $4, false, $5)`,
      [founderId, dim, score, observation, weight],
    );
  }

  await query(
    "UPDATE founder_profiles SET dna_self_assessment_completed_at = now(), updated_at = now() WHERE user_id = $1",
    [founderId],
  );

  background(recomputeFounderDna(founderId));
  background(recomputeMatchesForFounder(founderId));

  return json({ completedAt: new Date().toISOString() }, 201);
}

serveFunction(FN, [
  route(FN, "GET", "/:founderId", getAssessment),
  route(FN, "POST", "/:founderId", submitAssessment),
]);
