import { authenticate } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { background } from "../_shared/background.ts";
import { SOURCE_WEIGHTS, type EvidenceDimension } from "../_shared/founderScoring.ts";
import { recomputeFounderDna } from "../_shared/dnaRecompute.ts";
import { recomputeMatchesForFounder } from "../_shared/matchRecompute.ts";
import { assertActivityHasStarted } from "../_shared/activityGuard.ts";

const FN = "peer-feedback";

interface PeerFeedbackItem {
  dimension: EvidenceDimension;
  score: number;
  observation?: string;
}

// POST /functions/v1/peer-feedback  (any authenticated founder, about a peer
// — MVP screen 5's peer-feedback capture, folded into the Activities flow)
// { founderId, activityId?, items: [{dimension, score, observation?}, ...] }
// All 8 dimensions are optional per submission — the caller only includes
// the ones actually rated (was previously one dimension per request, which
// made the UI look like you had to pick a single dimension rather than
// rate whichever ones you had an opinion on). Fans out into `evidence` at
// source_type='peer', weight=0.8, same shape as evaluator_assessments'
// fan-out at weight 1.0 — one evidence row per rated dimension.
async function submitPeerFeedback(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { founderId, activityId, items } = body as {
    founderId?: string; activityId?: number; items?: PeerFeedbackItem[];
  };
  if (!founderId || !items?.length) return json({ error: "founderId and at least one rated dimension are required" }, 400);
  if (founderId === user.id) return json({ error: "Cannot give peer feedback about yourself" }, 400);
  for (const item of items) {
    if (!item.dimension || item.score == null) return json({ error: "Each item needs a dimension and a score" }, 400);
  }

  if (activityId != null) {
    const activityErr = await assertActivityHasStarted(activityId);
    if (activityErr) return json({ error: activityErr }, 400);
  }

  const createdIds: number[] = [];
  const skippedDimensions: string[] = [];
  for (const item of items) {
    if (activityId != null) {
      // PEER-01: skip a dimension already rated by this author for this
      // founder/activity rather than failing the whole batch — the form
      // lets you rate several dimensions at once, and one already-rated
      // one shouldn't block the rest. The DB also carries a matching
      // unique index as a backstop.
      const dupeRows = await query<{ id: number }>(
        `SELECT id FROM peer_feedback WHERE author_id = $1 AND founder_id = $2 AND activity_id = $3 AND dimension = $4`,
        [user.id, founderId, activityId, item.dimension],
      );
      if (dupeRows.length > 0) {
        skippedDimensions.push(item.dimension);
        continue;
      }
    }

    const feedbackRows = await query<{ id: number }>(
      `INSERT INTO peer_feedback (founder_id, author_id, activity_id, dimension, score, observation)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [founderId, user.id, activityId ?? null, item.dimension, item.score, item.observation ?? null],
    );
    createdIds.push(Number(feedbackRows[0].id));

    await query(
      `INSERT INTO evidence (founder_id, source_type, activity_id, evaluator_id, dimension, signal, score, observation, weight)
       VALUES ($1, 'peer', $2, $3, $4, $5, $6, $7, $8)`,
      [founderId, activityId ?? null, user.id, item.dimension, "Peer feedback", item.score, item.observation ?? null, SOURCE_WEIGHTS.peer],
    );
  }

  if (createdIds.length === 0) {
    return json({ error: "You already gave feedback on all of these dimensions for this founder in this activity." }, 409);
  }

  background(recomputeFounderDna(founderId));
  background(recomputeMatchesForFounder(founderId));

  return json({ ids: createdIds, skippedDimensions }, 201);
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
