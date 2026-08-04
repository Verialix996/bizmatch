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

// POST /functions/v1/messages/:matchId/invite  { projectId, role_title?, equity_pct?, salary? }
async function sendInvite(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  const reqBody = await req.json().catch(() => ({}));
  const { projectId, role_title, equity_pct, salary } = reqBody as {
    projectId?: string | number; role_title?: string; equity_pct?: number; salary?: number;
  };
  if (!matchId || !projectId) return json({ error: "matchId and projectId required" }, 400);

  const roleTitle = role_title ? String(role_title).trim() : null;
  const equityPct = equity_pct != null ? Number(equity_pct) : null;
  const salaryNum = salary != null ? Number(salary) : null;

  if (roleTitle) {
    const mod = moderateText(roleTitle);
    if (!mod.ok) return json({ error: `Role title flagged: ${mod.reason}` }, 400);
  }

  const matchRows = await query<{ id: string; user1_id: string; user2_id: string }>(
    "SELECT id, user1_id, user2_id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
    [matchId, user.id],
  );
  if (!matchRows[0]) return json({ error: "Not part of this match" }, 403);
  const match = matchRows[0];
  const inviteeId = match.user1_id === user.id ? match.user2_id : match.user1_id;

  const projectRows = await query<{ id: number; title: string }>(
    "SELECT id, title FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, user.id],
  );
  if (!projectRows[0]) return json({ error: "Project not found or not yours" }, 403);
  const project = projectRows[0];

  const existing = await query<{ id: number; status: string }>(
    "SELECT id, status FROM partner_invitations WHERE project_id = $1 AND invitee_id = $2",
    [projectId, inviteeId],
  );

  let invitationId: number | undefined;
  if (existing[0]) {
    if (existing[0].status === "pending") return json({ error: "Invite already pending" }, 409);
    if (existing[0].status === "accepted") {
      const partnerRows = await query(
        "SELECT 1 FROM project_partners WHERE project_id = $1 AND user_id = $2",
        [projectId, inviteeId],
      );
      if (partnerRows[0]) return json({ error: "User is already a partner" }, 409);
      await query("DELETE FROM partner_invitations WHERE id = $1", [existing[0].id]);
    } else {
      await query(
        `UPDATE partner_invitations SET status = 'pending', inviter_id = $1, match_id = $2,
           role_title = $3, equity_pct = $4, salary = $5, created_at = now() WHERE id = $6`,
        [user.id, matchId, roleTitle, equityPct, salaryNum, existing[0].id],
      );
      invitationId = existing[0].id;
    }
  }
  if (!invitationId) {
    const inserted = await query<{ id: number }>(
      `INSERT INTO partner_invitations (project_id, match_id, inviter_id, invitee_id, status, role_title, equity_pct, salary)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7) RETURNING id`,
      [projectId, matchId, user.id, inviteeId, roleTitle, equityPct, salaryNum],
    );
    invitationId = inserted[0].id;
  }

  const roleLabel = roleTitle ? ` as ${roleTitle}` : " as a partner";
  const msg = await sendMessage(
    matchId, user.id,
    `You've been invited to join "${project.title}"${roleLabel}.`,
    "partner_invite",
    { projectId, projectTitle: project.title, invitationId, roleTitle, equityPct, salary: salaryNum },
  );

  background((async () => {
    await emitNotification(inviteeId, "partner_invite", invitationId!, { projectId, projectTitle: project.title }).catch(() => {});
  })());

  return json({ invitation: { id: invitationId, projectId, inviteeId }, message: msg }, 201);
}

// POST /functions/v1/messages/:matchId/invite/:invitationId/respond  { accepted }
async function respondToInvite(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  const invitationId = params.invitationId;
  const reqBody = await req.json().catch(() => ({}));
  const accepted = (reqBody as { accepted?: boolean }).accepted === true;

  const invRows = await query<{ id: number; project_id: number; role_title: string | null }>(
    "SELECT * FROM partner_invitations WHERE id = $1 AND invitee_id = $2 AND status = 'pending'",
    [invitationId, user.id],
  );
  if (!invRows[0]) return json({ error: "Invitation not found or already resolved" }, 404);
  const inv = invRows[0];

  const newStatus = accepted ? "accepted" : "rejected";
  await query("UPDATE partner_invitations SET status = $1 WHERE id = $2", [newStatus, invitationId]);

  let msg;
  if (accepted) {
    const partnerRole = (inv.role_title || "member").trim().slice(0, 100);
    await query(
      `INSERT INTO project_partners (project_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = excluded.role`,
      [inv.project_id, user.id, partnerRole],
    );
    msg = await sendMessage(
      matchId, user.id,
      "Partner invite accepted! Welcome to the team.",
      "partner_invite_response",
      { invitationId, accepted: true, projectId: inv.project_id },
    );
  } else {
    msg = await sendMessage(
      matchId, user.id,
      "Partner invite declined.",
      "partner_invite_response",
      { invitationId, accepted: false, projectId: inv.project_id },
    );
  }

  return json({ status: newStatus, message: msg });
}

// POST /functions/v1/messages/:matchId/share-project  { projectId }
async function shareProject(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const matchId = params.matchId;
  const reqBody = await req.json().catch(() => ({}));
  const { projectId } = reqBody as { projectId?: string | number };
  if (!matchId || !projectId) return json({ error: "matchId and projectId required" }, 400);

  const matchRows = await query(
    "SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
    [matchId, user.id],
  );
  if (!matchRows[0]) return json({ error: "Not part of this match" }, 403);

  const projectRows = await query<Record<string, unknown>>(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2 AND is_active = true",
    [projectId, user.id],
  );
  if (!projectRows[0]) return json({ error: "Project not found or not yours" }, 403);
  const project = projectRows[0];

  const msg = await sendMessage(
    matchId, user.id,
    `Project details shared: "${project.title}"`,
    "project_shared",
    {
      projectId: project.id,
      title: project.title,
      description: project.description || null,
      industry: project.industry || null,
      stage: project.stage || null,
      fundingNeeded: project.funding_needed || null,
      deckUrl: project.deck_url || null,
      videoUrl: project.video_url || null,
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
  route(FN, "POST", "/:matchId/invite", sendInvite),
  route(FN, "POST", "/:matchId/invite/:invitationId/respond", respondToInvite),
  route(FN, "POST", "/:matchId/share-project", shareProject),
  route(FN, "POST", "/:matchId/read", markRead),
  route(FN, "GET", "/:matchId", listMessages),
  route(FN, "POST", "/:matchId", send),
]);
