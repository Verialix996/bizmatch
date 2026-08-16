import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { query } from "../_shared/db.ts";
import { background } from "../_shared/background.ts";
import { SOURCE_WEIGHTS } from "../_shared/founderScoring.ts";
import { INTERVIEW_EVALUATION_QUESTIONS } from "../_shared/interviewEvaluationQuestions.ts";
import { recomputeFounderDna } from "../_shared/dnaRecompute.ts";
import { recomputeMatchesForFounder } from "../_shared/matchRecompute.ts";
import { FounderInterviewsModel } from "./model.ts";

const FN = "founder-interviews";

interface InterviewAnswerRecord {
  skipped?: boolean;
  value?: { type: string; value?: boolean; optionId?: string };
}

function scaleOptionToScore(optionId?: string): number | null {
  const n = Number(optionId);
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return Math.round(n * 20); // 1-5 -> 20-100
}

// Fans the "7. Evaluator Assessment" section of a completed interview out into scored `evidence`
// rows, the same way the standalone evaluator-assessment form does (see the `assessments`
// function) — source_type='interview', weight 1.0. Called once per interview, right before it's
// marked completed (see completeInterview below, which guards against re-scoring an
// already-completed interview).
async function scoreInterviewEvaluation(interview: {
  founderId: string;
  interviewerId: string | null;
  answers: Record<string, InterviewAnswerRecord>;
}): Promise<void> {
  for (const [questionId, meta] of Object.entries(INTERVIEW_EVALUATION_QUESTIONS)) {
    const record = interview.answers?.[questionId];
    if (!record || record.skipped || !record.value) continue;

    const score = meta.kind === "scale"
      ? scaleOptionToScore(record.value.optionId)
      : record.value.type === "yes_no"
        ? (record.value.value === true ? 85 : 25)
        : null;
    if (score == null) continue;

    await query(
      `INSERT INTO evidence (founder_id, source_type, evaluator_id, dimension, signal, score, weight)
       VALUES ($1, 'interview', $2, $3, $4, $5, $6)`,
      [interview.founderId, interview.interviewerId, meta.dimension, meta.text, score, SOURCE_WEIGHTS.interview],
    );
  }

  background(recomputeFounderDna(interview.founderId));
  background(recomputeMatchesForFounder(interview.founderId));
}

// GET /functions/v1/founder-interviews?founderId=  (admin)
async function listInterviews(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const url = new URL(req.url);
  const founderId = url.searchParams.get("founderId");
  if (!founderId) return json({ error: "founderId required" }, 400);

  return json(await FounderInterviewsModel.list(founderId));
}

// GET /functions/v1/founder-interviews/:id  (admin)
async function getInterview(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const interview = await FounderInterviewsModel.get(params.id);
  if (!interview) return json({ error: "Interview not found" }, 404);
  return json(interview);
}

// POST /functions/v1/founder-interviews  (admin)  { founderId, meta? }
async function createInterview(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { founderId, meta } = body as { founderId?: string; meta?: unknown };
  if (!founderId) return json({ error: "founderId required" }, 400);

  const id = await FounderInterviewsModel.create(founderId, user.id, meta);
  return json({ id }, 201);
}

// PUT /functions/v1/founder-interviews/:id  (admin)  { meta?, answers? } — autosave
async function saveInterview(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const existing = await FounderInterviewsModel.get(params.id);
  if (!existing) return json({ error: "Interview not found" }, 404);
  // Completed interviews are the scored evidence source of record — letting
  // autosave silently keep overwriting answers after completion (previously
  // possible, no status check at all here) would make that evidence mutable
  // with no audit trail.
  if (existing.status === "completed") {
    return json({ error: "This interview is completed and read-only." }, 409);
  }

  const body = await req.json().catch(() => ({}));
  const { meta, answers } = body as { meta?: unknown; answers?: unknown };
  await FounderInterviewsModel.save(params.id, meta, answers);
  return json({ ok: true });
}

// POST /functions/v1/founder-interviews/:id/complete  (admin)
async function completeInterview(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const interview = await FounderInterviewsModel.get(params.id);
  if (!interview) return json({ error: "Interview not found" }, 404);

  // Idempotency: a retried/duplicate "complete" call on an interview already marked completed
  // must not score its evaluation answers into evidence a second time.
  if (interview.status !== "completed") {
    await scoreInterviewEvaluation({
      founderId: interview.founderId,
      interviewerId: interview.interviewerId,
      answers: interview.answers,
    });
  }

  await FounderInterviewsModel.complete(params.id);
  return json({ ok: true });
}

// DELETE /functions/v1/founder-interviews/:id  (admin)
async function deleteInterview(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const existing = await FounderInterviewsModel.get(params.id);
  if (!existing) return json({ error: "Interview not found" }, 404);
  if (existing.status === "completed") {
    return json({ error: "Completed interviews can't be deleted." }, 409);
  }

  await FounderInterviewsModel.remove(params.id);
  return json({ ok: true });
}

serveFunction(FN, [
  route(FN, "GET", "", listInterviews),
  route(FN, "POST", "", createInterview),
  route(FN, "GET", "/:id", getInterview),
  route(FN, "PUT", "/:id", saveInterview),
  route(FN, "POST", "/:id/complete", completeInterview),
  route(FN, "DELETE", "/:id", deleteInterview),
]);
