import { authenticate, requireVerified } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { moderateText } from "../_shared/moderation.ts";
import { sendMessage } from "../_shared/messageService.ts";
import { emitNotification } from "../_shared/notifications.ts";
import { background } from "../_shared/background.ts";
import { getMessages, getConversations, markMessagesRead } from "./model.ts";

const FN = "messages";

// GET /functions/v1/messages
async function conversations(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  return json(await getConversations(user.id));
}

// GET /functions/v1/messages/:matchId
async function listMessages(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  if (!matchId) return json({ error: "Invalid matchId" }, 400);

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;
  const afterParam = url.searchParams.get("after");
  const after = afterParam != null ? Number(afterParam) : null;

  const rows = await getMessages(matchId, user.id, limit, offset, after);
  if (rows === null) return json({ error: "Not part of this match" }, 403);

  return json(rows);
}

// POST /functions/v1/messages/:matchId  { body }
async function send(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  const reqBody = await req.json().catch(() => ({}));
  const { body } = reqBody as { body?: string };

  if (!matchId) return json({ error: "Invalid matchId" }, 400);
  if (!body || !body.trim()) return json({ error: "Message body required" }, 400);

  const mod = moderateText(body.trim());
  if (!mod.ok) return json({ error: `Message flagged by moderation: ${mod.reason}` }, 400);

  const msg = await sendMessage(matchId, user.id, body.trim());
  if (!msg) return json({ error: "Not part of this match" }, 403);

  background((async () => {
    try {
      const matchRows = await query<{ user1_id: string; user2_id: string }>(
        "SELECT user1_id, user2_id FROM matches WHERE id = $1",
        [matchId],
      );
      if (!matchRows[0]) return;
      const receiverId = matchRows[0].user1_id === user.id ? matchRows[0].user2_id : matchRows[0].user1_id;
      const existing = await query(
        `SELECT id FROM notifications WHERE user_id = $1 AND type = 'message' AND ref_id = $2 AND read_at IS NULL LIMIT 1`,
        [receiverId, matchId],
      );
      if (existing.length) return;
      const senderRows = await query<{ name: string }>("SELECT name FROM users WHERE id = $1", [user.id]);
      await emitNotification(receiverId, "message", matchId, {
        matchId,
        fromName: senderRows[0]?.name || "Someone",
      });
    } catch { /* non-critical */ }
  })());

  return json(msg, 201);
}

// POST /functions/v1/messages/:matchId/share-submission  { challengeId, teamId }
async function shareSubmission(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  const reqBody = await req.json().catch(() => ({}));
  const { challengeId, teamId } = reqBody as { challengeId?: string | number; teamId?: string | number };

  if (!matchId || !challengeId || !teamId) return json({ error: "matchId, challengeId, and teamId are required" }, 400);

  const matchRows = await query(
    "SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
    [matchId, user.id],
  );
  if (!matchRows[0]) return json({ error: "Not part of this match" }, 403);

  const memberRows = await query(
    "SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'accepted'",
    [teamId, user.id],
  );
  if (!memberRows[0]) return json({ error: "Not a member of this team" }, 403);

  const rows = await query<Record<string, unknown>>(
    `SELECT cs.deck_url, cs.video_url, cs.ai_review, c.title AS challenge_title, t.name AS team_name
     FROM challenge_signups cs
     JOIN challenges c ON c.id = cs.challenge_id
     JOIN teams t ON t.id = cs.team_id
     WHERE cs.challenge_id = $1 AND cs.team_id = $2`,
    [challengeId, teamId],
  );
  if (!rows[0]) return json({ error: "Submission not found" }, 404);
  const submission = rows[0];
  const aiReview = submission.ai_review as { overallScore?: number } | null;

  const msg = await sendMessage(
    matchId, user.id,
    `Submission shared: "${submission.challenge_title}"`,
    "submission_shared",
    {
      challengeId,
      teamId,
      challengeTitle: submission.challenge_title,
      teamName: submission.team_name,
      deckUrl: submission.deck_url || null,
      videoUrl: submission.video_url || null,
      overallScore: aiReview?.overallScore ?? null,
    },
  );

  return json(msg, 201);
}

// POST /functions/v1/messages/:matchId/read
async function markRead(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  if (!matchId) return json({ error: "Invalid matchId" }, 400);
  await markMessagesRead(matchId, user.id);
  return json({ ok: true });
}

serveFunction(FN, [
  route(FN, "GET", "", conversations),
  route(FN, "POST", "/:matchId/share-submission", shareSubmission),
  route(FN, "POST", "/:matchId/read", markRead),
  route(FN, "GET", "/:matchId", listMessages),
  route(FN, "POST", "/:matchId", send),
]);
