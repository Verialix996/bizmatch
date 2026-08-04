import { authenticate, requireVerified } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { sendMessage } from "../_shared/messageService.ts";
import { emitNotification } from "../_shared/notifications.ts";
import { background } from "../_shared/background.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";
import { createMeeting, getMeetingById, getMeetingsForUser, updateMeetingStatus, saveBriefing } from "./model.ts";

const FN = "meetings";

// POST /functions/v1/meetings  { matchId, title, scheduledAt, locationType, videoLink, address }
async function propose(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const body = await req.json().catch(() => ({}));
  const { matchId, title, scheduledAt, locationType, videoLink, address } = body as Record<string, string>;

  if (!matchId || !scheduledAt || !locationType) {
    return json({ error: "matchId, scheduledAt, and locationType are required" }, 400);
  }
  if (!["virtual", "in_person"].includes(locationType)) {
    return json({ error: "locationType must be virtual or in_person" }, 400);
  }
  if (locationType === "virtual" && !videoLink) {
    return json({ error: "videoLink is required for virtual meetings" }, 400);
  }
  if (locationType === "in_person" && !address) {
    return json({ error: "address is required for in-person meetings" }, 400);
  }

  const matchRows = await query<{ id: number; user1_id: string; user2_id: string }>(
    "SELECT id, user1_id, user2_id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
    [matchId, user.id],
  );
  if (!matchRows[0]) return json({ error: "Not part of this match" }, 403);

  const isPremium = user.is_premium && user.premium_expires_at && new Date(user.premium_expires_at) > new Date();
  if (!isPremium) {
    return json(
      { error: "Meeting proposals are a Premium feature. Upgrade to send meeting invites.", upgradeRequired: true },
      403,
    );
  }

  const match = matchRows[0];
  const receiverId = match.user1_id === user.id ? match.user2_id : match.user1_id;

  const meeting = await createMeeting({
    matchId, proposerId: user.id, receiverId, title, scheduledAt, locationType, videoLink, address,
  }) as Record<string, unknown>;

  await sendMessage(matchId, user.id, `Meeting proposed: ${title || "Untitled"}`, "meeting_proposal", {
    meetingId: meeting.id,
    title: meeting.title,
    scheduledAt: meeting.scheduled_at,
    locationType: meeting.location_type,
    address: meeting.address || null,
    videoLink: meeting.video_link || null,
    status: meeting.status,
  });

  background(emitNotification(receiverId, "meeting", meeting.id as number, { title: meeting.title, matchId }));

  return json(meeting, 201);
}

// PUT /functions/v1/meetings/:id  { status }
async function respond(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (!status || !["confirmed", "declined", "cancelled"].includes(status)) {
    return json({ error: "status must be confirmed, declined, or cancelled" }, 400);
  }

  const meeting = await getMeetingById(id) as Record<string, unknown> | null;
  if (!meeting) return json({ error: "Meeting not found" }, 404);
  if (meeting.receiver_id !== user.id && meeting.proposer_id !== user.id) {
    return json({ error: "Not part of this meeting" }, 403);
  }
  if (status === "cancelled") {
    const isProposer = meeting.proposer_id === user.id;
    const isReceiverCancellingConfirmed = meeting.receiver_id === user.id && meeting.status === "confirmed";
    if (!isProposer && !isReceiverCancellingConfirmed) {
      return json({ error: "You cannot cancel this meeting" }, 403);
    }
  }
  if (["confirmed", "declined"].includes(status) && meeting.receiver_id !== user.id) {
    return json({ error: "Only the receiver can confirm or decline" }, 403);
  }

  const updated = await updateMeetingStatus(id, status);

  await sendMessage(meeting.match_id as string, user.id, `Meeting ${status}`, "meeting_response", {
    meetingId: id,
    status,
  });

  return json(updated);
}

// GET /functions/v1/meetings
async function list(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  return json(await getMeetingsForUser(user.id));
}

// PATCH /functions/v1/meetings/:id/reschedule  { scheduledAt, locationType?, videoLink?, address? }
async function reschedule(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const meetingId = params.id;
  const body = await req.json().catch(() => ({}));
  const { scheduledAt, locationType, videoLink, address } = body as Record<string, string>;

  if (!scheduledAt) return json({ error: "scheduledAt is required" }, 400);

  const meeting = await getMeetingById(meetingId) as Record<string, unknown> | null;
  if (!meeting) return json({ error: "Meeting not found" }, 404);

  const isParticipant = meeting.proposer_id === user.id || meeting.receiver_id === user.id;
  if (!isParticipant) return json({ error: "Not part of this meeting" }, 403);

  if (!["proposed", "confirmed"].includes(meeting.status as string)) {
    return json({ error: "Can only reschedule a proposed or confirmed meeting" }, 400);
  }
  if (meeting.status === "proposed" && meeting.receiver_id !== user.id) {
    return json({ error: "Only the receiver can reschedule a proposed meeting" }, 403);
  }

  const otherUserId = meeting.proposer_id === user.id ? meeting.receiver_id : meeting.proposer_id;
  const newLocationType = locationType || (meeting.location_type as string);

  await query(
    `UPDATE meetings SET
       scheduled_at  = $1,
       location_type = $2,
       video_link    = $3,
       address       = $4,
       proposer_id   = $5,
       receiver_id   = $6,
       status        = 'proposed'
     WHERE id = $7`,
    [
      scheduledAt,
      newLocationType,
      newLocationType === "virtual" ? (videoLink || null) : null,
      newLocationType === "in_person" ? (address || null) : null,
      user.id, otherUserId, meetingId,
    ],
  );

  const updated = await getMeetingById(meetingId);

  await sendMessage(
    meeting.match_id as string, user.id,
    `Meeting rescheduled to ${new Date(scheduledAt).toLocaleString()}. Please confirm or decline.`,
    "meeting_response",
    { meetingId, status: "rescheduled" },
  );

  return json(updated);
}

const BRIEFING_PROMPT_HEADER = `You are a business meeting preparation assistant for BizMatch. Given the profile below of the person the user is about to meet, produce a concise prep report.

Respond ONLY with valid JSON, no markdown:
{"personSummary":"...","matchRationale":"...","talkingPoints":["..."],"questionsToAsk":["..."],"watchOutFor":["..."]}`;

// GET /functions/v1/meetings/:id/briefing
async function briefing(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const meeting = await getMeetingById(params.id) as Record<string, unknown> | null;
  if (!meeting) return json({ error: "Meeting not found" }, 404);
  if (meeting.proposer_id !== user.id && meeting.receiver_id !== user.id) {
    return json({ error: "Not part of this meeting" }, 403);
  }

  if (meeting.briefing) return json(meeting.briefing);

  if (!isGeminiConfigured()) return json({ error: "AI briefing not configured" }, 503);

  const otherId = meeting.proposer_id === user.id ? meeting.receiver_id : meeting.proposer_id;

  const otherRows = await query<Record<string, unknown>>(
    `SELECT u.name, u.role, u.bio, u.skills, u.hobbies, u.role AS role_type,
            ip.investment_domain, ip.preferred_stage, ip.max_investment
     FROM users u
     LEFT JOIN investor_profiles ip ON ip.user_id = u.id
     WHERE u.id = $1`,
    [otherId],
  );
  const other = otherRows[0];
  if (!other) return json({ error: "User not found" }, 404);

  const projectRows = await query<Record<string, unknown>>(
    `SELECT title, stage, industry, funding_needed
     FROM projects WHERE user_id = $1 AND is_active = true
     ORDER BY created_at DESC LIMIT 3`,
    [otherId],
  );

  const skillsList = Array.isArray(other.skills) ? (other.skills as string[]).join(", ") : "";
  const projectsList = projectRows.map((p) =>
    `- ${p.title} (${p.stage || "N/A"}, ${p.industry || "N/A"}, seeking $${p.funding_needed || 0})`
  ).join("\n") || "None listed";

  const prompt = `${BRIEFING_PROMPT_HEADER}

Name: ${other.name}
Role: ${other.role}
Bio: ${other.bio || "N/A"}
Skills: ${skillsList || "N/A"}
Investment domain: ${other.investment_domain || "N/A"}
Preferred stage: ${other.preferred_stage || "N/A"}
Max investment: $${other.max_investment || 0}
Recent projects:
${projectsList}`;

  let parsed: Record<string, unknown>;
  try {
    const raw = (await generateText(prompt)).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "AI returned an unexpected format. Please try again." }, 500);
  }

  await saveBriefing(params.id, parsed);
  return json(parsed);
}

serveFunction(FN, [
  route(FN, "POST", "", propose),
  route(FN, "GET", "", list),
  route(FN, "GET", "/:id/briefing", briefing),
  route(FN, "PUT", "/:id", respond),
  route(FN, "PATCH", "/:id/reschedule", reschedule),
]);
