import { authenticate } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { background } from "../_shared/background.ts";
import { SOURCE_WEIGHTS, type EvidenceDimension } from "../_shared/founderScoring.ts";
import { recomputeFounderDna } from "../_shared/dnaRecompute.ts";
import { recomputeMatchesForFounder } from "../_shared/matchRecompute.ts";

const FN = "peer-feedback";

// POST /functions/v1/peer-feedback  (any authenticated founder, about a peer
// — MVP screen 5's peer-feedback capture, folded into the Activities flow)
// { founderId, activityId?, dimension, score, observation? }
// Fans out into `evidence` at source_type='peer', weight=0.8, same shape as
// evaluator_assessments' fan-out at weight 1.0.
async function submitPeerFeedback(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { founderId, activityId, dimension, score, observation } = body as {
    founderId?: string; activityId?: number; dimension?: EvidenceDimension; score?: number; observation?: string;
  };
  if (!founderId || !dimension || score == null) {
    return json({ error: "founderId, dimension, and score are required" }, 400);
  }
  if (founderId === user.id) return json({ error: "Cannot give peer feedback about yourself" }, 400);

  const feedbackRows = await query<{ id: number }>(
    `INSERT INTO peer_feedback (founder_id, author_id, activity_id, dimension, score, observation)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [founderId, user.id, activityId ?? null, dimension, score, observation ?? null],
  );
  const feedbackId = Number(feedbackRows[0].id);

  await query(
    `INSERT INTO evidence (founder_id, source_type, activity_id, evaluator_id, dimension, signal, score, observation, weight)
     VALUES ($1, 'peer', $2, $3, $4, $5, $6, $7, $8)`,
    [founderId, activityId ?? null, user.id, dimension, "Peer feedback", score, observation ?? null, SOURCE_WEIGHTS.peer],
  );

  background(recomputeFounderDna(founderId));
  background(recomputeMatchesForFounder(founderId));

  return json({ id: feedbackId }, 201);
}

// GET /functions/v1/peer-feedback?founderId=  (admin only — a founder never
// sees who gave feedback about them or what it said, same rule as /evidence)
async function listPeerFeedback(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const founderId = url.searchParams.get("founderId");
  if (!founderId) return json({ error: "founderId required" }, 400);
  if (user.role !== "admin") return json({ error: "Forbidden" }, 403);

  const rows = await query<Record<string, unknown>>(
    `SELECT pf.id, pf.dimension, pf.score, pf.observation, pf.created_at, pf.activity_id,
            a.name AS author_name
     FROM peer_feedback pf JOIN users a ON a.id = pf.author_id
     WHERE pf.founder_id = $1
     ORDER BY pf.created_at DESC`,
    [founderId],
  );
  return json(rows);
}

serveFunction(FN, [
  route(FN, "GET", "", listPeerFeedback),
  route(FN, "POST", "", submitPeerFeedback),
]);
