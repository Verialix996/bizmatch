import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { background } from "../_shared/background.ts";
import { SOURCE_WEIGHTS, type EvidenceSource, type EvidenceDimension } from "../_shared/founderScoring.ts";
import { recomputeFounderDna } from "../_shared/dnaRecompute.ts";

const FN = "evidence";

// POST /functions/v1/evidence  (admin — manual "Add Evaluation"/raw entry)
async function createEvidence(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const {
    founderId, sourceType, activityId, evaluatorId, dimension,
    signal, score, observation, isNegative,
  } = body as {
    founderId?: string; sourceType?: EvidenceSource; activityId?: number; evaluatorId?: string;
    dimension?: EvidenceDimension; signal?: string; score?: number; observation?: string; isNegative?: boolean;
  };

  if (!founderId || !sourceType || !dimension || score == null) {
    return json({ error: "founderId, sourceType, dimension, and score are required" }, 400);
  }
  const weight = SOURCE_WEIGHTS[sourceType];
  if (weight == null) return json({ error: "Invalid sourceType" }, 400);

  const rows = await query<{ id: number }>(
    `INSERT INTO evidence (founder_id, source_type, activity_id, evaluator_id, dimension, signal, score, observation, is_negative, weight)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [founderId, sourceType, activityId ?? null, evaluatorId ?? null, dimension, signal ?? null, score, observation ?? null, !!isNegative, weight],
  );
  const evidenceId = Number(rows[0].id);

  background(recomputeFounderDna(founderId, evidenceId));

  return json({ id: evidenceId }, 201);
}

// GET /functions/v1/evidence?founderId=&dimension=&source=&activityId=&sign=positive|negative
async function listEvidence(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const founderId = url.searchParams.get("founderId");
  if (!founderId) return json({ error: "founderId required" }, 400);
  if (user.role !== "admin" && user.id !== founderId) return json({ error: "Forbidden" }, 403);

  const dimension = url.searchParams.get("dimension");
  const source = url.searchParams.get("source");
  const activityId = url.searchParams.get("activityId");
  const sign = url.searchParams.get("sign");

  const rows = await query<Record<string, unknown>>(
    `SELECT e.id, e.source_type, e.dimension, e.signal, e.score, e.confidence,
            e.observation, e.is_negative, e.created_at,
            ev.name AS evaluator_name
     FROM evidence e
     LEFT JOIN users ev ON ev.id = e.evaluator_id
     WHERE e.founder_id = $1
       AND ($2::evidence_dimension IS NULL OR e.dimension = $2)
       AND ($3::evidence_source IS NULL OR e.source_type = $3)
       AND ($4::bigint IS NULL OR e.activity_id = $4)
       AND ($5::text IS NULL
            OR ($5 = 'positive' AND e.is_negative = false)
            OR ($5 = 'negative' AND e.is_negative = true))
     ORDER BY e.created_at DESC`,
    [founderId, dimension, source, activityId ? Number(activityId) : null, sign],
  );
  return json(rows);
}

serveFunction(FN, [
  route(FN, "GET", "", listEvidence),
  route(FN, "POST", "", createEvidence),
]);
