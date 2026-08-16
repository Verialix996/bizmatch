import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { query, parseJsonColumn } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { background } from "../_shared/background.ts";
import { SOURCE_WEIGHTS, type EvidenceDimension } from "../_shared/founderScoring.ts";
import { recomputeFounderDna } from "../_shared/dnaRecompute.ts";
import { recomputeMatchesForFounder } from "../_shared/matchRecompute.ts";
import { assertActivityHasStarted } from "../_shared/activityGuard.ts";

const FN = "assessments";

type AnswerType = "open_text" | "scale_1_5" | "yes_no" | "tags";

interface AssessmentItemInput {
  questionText: string;
  answerType: AnswerType;
  answer: unknown;
  criteriaTag?: EvidenceDimension;
  notes?: string;
}

// Maps an answered item to an evidence score, when the answer type is
// numeric/boolean and a dimension (criteriaTag) was assigned to the
// question. open_text/tags answers are captured for the record but don't
// auto-generate a scored evidence row for MVP.
function itemToEvidenceScore(item: AssessmentItemInput): number | null {
  if (!item.criteriaTag) return null;
  if (item.answerType === "scale_1_5") {
    const n = Number(item.answer);
    if (!Number.isFinite(n) || n < 1 || n > 5) return null;
    return Math.round(n * 20); // 1-5 -> 20-100
  }
  if (item.answerType === "yes_no") {
    return item.answer === true ? 85 : 25;
  }
  return null;
}

// POST /functions/v1/assessments  (admin/evaluator — MVP screen 6)
async function submitAssessment(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { founderId, activityId, notes, items } = body as {
    founderId?: string; activityId?: number; notes?: string; items?: AssessmentItemInput[];
  };
  if (!founderId || !items?.length) return json({ error: "founderId and items are required" }, 400);

  if (activityId != null) {
    const activityErr = await assertActivityHasStarted(activityId);
    if (activityErr) return json({ error: activityErr }, 400);
  }

  // Dedup guard: the same evaluator submitting for the same founder within a
  // minute is almost always a double-tap/duplicate submission, not two
  // genuine evaluations — and since scoring is a weighted average, letting
  // it through would silently skew the founder's score.
  const recentRows = await query<{ id: number }>(
    `SELECT id FROM evaluator_assessments
     WHERE founder_id = $1 AND evaluator_id = $2 AND submitted_at > now() - interval '60 seconds'`,
    [founderId, user.id],
  );
  if (recentRows.length > 0) {
    return json({ error: "You just submitted an evaluation for this founder — wait a moment before submitting another." }, 429);
  }

  const assessmentRows = await query<{ id: number }>(
    `INSERT INTO evaluator_assessments (founder_id, evaluator_id, activity_id, notes)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [founderId, user.id, activityId ?? null, notes ?? null],
  );
  const assessmentId = Number(assessmentRows[0].id);

  const weight = SOURCE_WEIGHTS.evaluator;
  for (const item of items) {
    await query(
      `INSERT INTO evaluator_assessment_items (assessment_id, question_text, answer_type, answer, criteria_tag, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [assessmentId, item.questionText, item.answerType, JSON.stringify(item.answer ?? null), item.criteriaTag ?? null, item.notes ?? null],
    );

    const score = itemToEvidenceScore(item);
    if (score != null && item.criteriaTag) {
      await query(
        `INSERT INTO evidence (founder_id, source_type, activity_id, evaluator_id, dimension, signal, score, observation, weight)
         VALUES ($1, 'evaluator', $2, $3, $4, $5, $6, $7, $8)`,
        [founderId, activityId ?? null, user.id, item.criteriaTag, item.questionText, score, item.notes ?? null, weight],
      );
    }
  }

  background(recomputeFounderDna(founderId));
  background(recomputeMatchesForFounder(founderId));

  return json({ id: assessmentId }, 201);
}

// GET /functions/v1/assessments?founderId=
async function listAssessments(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const founderId = url.searchParams.get("founderId");
  if (!founderId) return json({ error: "founderId required" }, 400);
  // Admin-only, same as /evidence and /peer-feedback — a founder never sees
  // the evaluator's questions/notes about them directly.
  if (user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const assessments = await query<Record<string, unknown>>(
    `SELECT ea.id, ea.submitted_at, ea.notes, ea.activity_id, ev.name AS evaluator_name
     FROM evaluator_assessments ea
     JOIN users ev ON ev.id = ea.evaluator_id
     WHERE ea.founder_id = $1
     ORDER BY ea.submitted_at DESC`,
    [founderId],
  );

  const ids = assessments.map((a) => Number(a.id));
  const items = ids.length
    ? await query<Record<string, unknown>>(
      `SELECT assessment_id, question_text, answer_type, answer, criteria_tag, notes
       FROM evaluator_assessment_items WHERE assessment_id = ANY($1::bigint[])`,
      [ids],
    )
    : [];

  const itemsByAssessment = new Map<number, Record<string, unknown>[]>();
  for (const item of items) {
    const id = Number(item.assessment_id);
    if (!itemsByAssessment.has(id)) itemsByAssessment.set(id, []);
    itemsByAssessment.get(id)!.push({ ...item, answer: parseJsonColumn(item.answer, null) });
  }

  return json(
    assessments.map((a) => ({ ...a, items: itemsByAssessment.get(Number(a.id)) ?? [] })),
  );
}

serveFunction(FN, [
  route(FN, "GET", "", listAssessments),
  route(FN, "POST", "", submitAssessment),
]);
