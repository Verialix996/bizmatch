import { authenticate, requireVerified } from "../_shared/auth.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { moderateText } from "../_shared/moderation.ts";
import { uploadBuffer, BUCKETS } from "../_shared/storage.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";
import { emitNotification } from "../_shared/notifications.ts";
import { background } from "../_shared/background.ts";
import * as Teams from "./teamModel.ts";
import * as Challenges from "./challengeModel.ts";
import * as Offers from "./offerModel.ts";
import { generateCohesionChallenge, reviewCohesionSubmission } from "./cohesionModel.ts";

const FN = "challenges";
const MB = 1024 * 1024;

// Every :id/:teamId path param here is a bigint PK — reject non-numeric input
// as 404 before it reaches a raw SQL query (matches the guard already used in
// the retired projects/index.ts's getOne, avoiding a raw "invalid input
// syntax for type bigint" 500 from garbage/undefined ids).
const isNumericId = (id: string | undefined | null): boolean => !!id && /^\d+$/.test(id);

const DECK_REVIEW_PROMPT = `You are an experienced startup investor reviewing a pitch deck for investment readiness.

Evaluate the document ONLY as a business pitch deck against these standard investor criteria:
1. Problem statement — is a clear real-world problem defined?
2. Solution — is the product/service clearly explained?
3. Market size — is TAM/SAM/SOM or market opportunity shown?
4. Business model — how does the company make money?
5. Traction — any users, revenue, partnerships, or milestones?
6. Team — are founders/key people introduced with relevant background?
7. Financial projections — are growth forecasts or unit economics shown?
8. Funding ask — is the amount sought and its use of funds stated?

If the document is NOT a business pitch deck, set overallScore to 1 and state clearly in weaknesses that this does not appear to be a pitch deck.

Respond ONLY with valid JSON, no markdown:
{"strengths":["..."],"weaknesses":["..."],"suggestions":["..."],"overallScore":7}`;

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

async function createTeam(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "entrepreneur") return json({ error: "Only entrepreneurs can form teams" }, 403);

  const body = await req.json().catch(() => ({}));
  const { name, stage, industry, fundingNeeded } = body as Record<string, unknown>;
  if (!name || typeof name !== "string" || !name.trim()) return json({ error: "name is required" }, 400);

  const mod = moderateText(name.trim());
  if (!mod.ok) return json({ error: `Team name flagged by moderation: ${mod.reason}` }, 400);

  const team = await Teams.createTeam(user.id, {
    name: name.trim(),
    stage: stage as string | undefined,
    industry: industry as string | undefined,
    fundingNeeded: fundingNeeded as number | undefined,
  });
  return json(team, 201);
}

async function updateTeam(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Team not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const { stage, industry, fundingNeeded } = body as Record<string, unknown>;
  const team = await Teams.updateTeam(params.id, user.id, {
    stage: stage as string | undefined,
    industry: industry as string | undefined,
    fundingNeeded: fundingNeeded as number | undefined,
  });
  if (!team) return json({ error: "Team not found or not yours" }, 404);
  return json(team);
}

async function inviteToTeam(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Team not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const { userId } = body as { userId?: string };
  if (!userId) return json({ error: "userId is required" }, 400);
  if (userId === user.id) return json({ error: "Cannot invite yourself" }, 400);

  const team = await Teams.getTeamById(params.id);
  if (!team) return json({ error: "Team not found" }, 404);
  if (team.creator_id !== user.id) return json({ error: "Only the team creator can invite" }, 403);

  const matchId = await Teams.hasExistingMatch(user.id, userId);
  if (!matchId) return json({ error: "You must have a match with this user to invite them" }, 403);

  if (await Teams.isAlreadyOnTeam(params.id, userId)) {
    return json({ error: "Already invited or a member" }, 409);
  }

  const invite = await Teams.inviteMember(params.id, userId, user.id, matchId);
  background(emitNotification(userId, "team_invite", invite.id, { teamId: Number(params.id), invitedBy: user.id, teamName: team.name }));
  return json({ id: invite.id, status: "invited" }, 201);
}

async function respondToInvite(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Team not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const { accept } = body as { accept?: boolean };
  const result = await Teams.respondToInvite(params.id, user.id, accept === true);
  if (!result) return json({ error: "No pending invite found" }, 404);

  if (accept === true) {
    const count = await Teams.acceptedMemberCount(params.id);
    if (count === 2) {
      background(
        generateCohesionChallenge(params.id).then(async () => {
          const memberIds = await Offers.getAcceptedMemberIds(params.id);
          for (const uid of memberIds) {
            await emitNotification(uid, "challenge_signup", Number(params.id), { teamId: Number(params.id), reason: "cohesion_test_ready" });
          }
        }).catch((err) => console.error("[cohesion generation]", err)),
      );
    }
  }

  return json({ id: result.id, status: accept ? "accepted" : "declined" });
}

async function leaveTeamHandler(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Team not found" }, 404);

  const left = await Teams.leaveTeam(params.id, user.id);
  if (!left) return json({ error: "Cannot leave (not a member, or you're the creator)" }, 400);
  return json({ ok: true });
}

async function getMyTeams(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json(await Teams.getMyTeams(user.id));
}

async function getMyPendingInvites(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json(await Teams.getMyPendingInvites(user.id));
}

async function getTeam(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Team not found" }, 404);

  const team = await Teams.getTeamById(params.id);
  if (!team) return json({ error: "Team not found" }, 404);
  if (team.creator_id !== user.id && !(await Teams.isAcceptedMember(params.id, user.id))) {
    return json({ error: "Not a member of this team" }, 403);
  }
  return json({ ...team, members: await Teams.getMembers(params.id) });
}

// ---------------------------------------------------------------------------
// Challenges (hackathons)
// ---------------------------------------------------------------------------

async function createChallenge(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;
  if (user.role !== "investor") return json({ error: "Only investors can create challenges" }, 403);

  const body = await req.json().catch(() => ({}));
  const { title, description, judgingCriteria, investmentTeaser, submissionDeadline } = body as Record<string, unknown>;
  if (!title || typeof title !== "string" || !title.trim()) return json({ error: "title is required" }, 400);
  if (!submissionDeadline) return json({ error: "submissionDeadline is required" }, 400);

  for (const [label, text] of [["Title", title], ["Description", description], ["Judging criteria", judgingCriteria], ["Investment teaser", investmentTeaser]] as const) {
    if (typeof text === "string" && text) {
      const mod = moderateText(text);
      if (!mod.ok) return json({ error: `${label} flagged by moderation: ${mod.reason}` }, 400);
    }
  }

  const challenge = await Challenges.createChallenge(user.id, {
    title: title.trim(),
    description: description as string | undefined,
    judgingCriteria: judgingCriteria as string | undefined,
    investmentTeaser: investmentTeaser as string | undefined,
    submissionDeadline: submissionDeadline as string,
  });
  return json(challenge, 201);
}

async function draftDescription(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "investor") return json({ error: "Only investors can draft challenges" }, 403);
  if (!isGeminiConfigured()) return json({ error: "AI unavailable" }, 503);

  const body = await req.json().catch(() => ({}));
  const { prompt } = body as { prompt?: string };
  if (!prompt) return json({ error: "prompt is required" }, 400);

  const text = await generateText(
    `You are helping an investor draft a hackathon-style challenge for startup teams. Based on this brief, write a clear, compelling challenge description (3-6 sentences), no markdown, no preamble:\n\n${prompt}`,
  );
  return json({ description: text });
}

async function getOpenChallenges(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;
  return json(await Challenges.getOpenChallenges(limit, offset));
}

async function getChallenge(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);
  const challenge = await Challenges.getChallengeById(params.id);
  if (!challenge) return json({ error: "Challenge not found" }, 404);
  return json(challenge);
}

async function getMyChallenges(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "investor") return json({ error: "Only investors have created challenges" }, 403);
  return json(await Challenges.getMyChallenges(user.id));
}

// ---------------------------------------------------------------------------
// Signups / Submissions
// ---------------------------------------------------------------------------

async function signupForChallenge(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const { teamId } = body as { teamId?: string };
  if (!teamId || !isNumericId(teamId)) return json({ error: "teamId is required" }, 400);
  if (!(await Teams.isAcceptedMember(teamId, user.id))) return json({ error: "Not a member of this team" }, 403);

  const challenge = await Challenges.getChallengeById(params.id);
  if (!challenge || challenge.type !== "hackathon") return json({ error: "Challenge not found" }, 404);
  if (challenge.status !== "open" || new Date(challenge.submission_deadline) <= new Date()) {
    return json({ error: "This challenge is no longer accepting signups" }, 400);
  }

  if (!(await Challenges.hasCompletedCohesionTest(teamId))) {
    return json({ error: "Complete your team cohesion challenge first" }, 403);
  }

  const existing = await Challenges.getSignup(params.id, teamId);
  if (existing) return json({ error: "Already signed up" }, 409);

  const signup = await Challenges.createSignup(params.id, teamId);
  return json(signup, 201);
}

async function uploadSignupFile(req: Request, params: Record<string, string>, field: "deck" | "video"): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Signup not found" }, 404);

  const signup = await Challenges.getSignupById(params.id) as Record<string, unknown> | null;
  if (!signup) return json({ error: "Signup not found" }, 404);
  if (!(await Teams.isAcceptedMember(String(signup.team_id), user.id))) return json({ error: "Not a member of this team" }, 403);

  const form = await req.formData();
  const file = form.get(field) as File | null;
  if (!file) return json({ error: "No file uploaded" }, 400);

  if (field === "deck") {
    if (file.size > 20 * MB) return json({ error: "File too large" }, 413);
    const buffer = new Uint8Array(await file.arrayBuffer());
    const url = await uploadBuffer(BUCKETS.deck, `${signup.team_id}/${params.id}-${Date.now()}.pdf`, buffer, "application/pdf");
    await Challenges.updateSignupFile(params.id, "deck_url", url);
    return json({ deck_url: url });
  } else {
    if (file.size > 100 * MB) return json({ error: "File too large" }, 413);
    const buffer = new Uint8Array(await file.arrayBuffer());
    const url = await uploadBuffer(BUCKETS.video, `${signup.team_id}/${params.id}-${Date.now()}.mp4`, buffer, file.type || "video/mp4");
    await Challenges.updateSignupFile(params.id, "video_url", url);
    return json({ video_url: url });
  }
}

async function aiReviewSignup(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isGeminiConfigured()) return json({ error: "AI review not configured" }, 503);
  if (!isNumericId(params.id)) return json({ error: "Signup not found" }, 404);

  const signup = await Challenges.getSignupById(params.id) as Record<string, unknown> | null;
  if (!signup) return json({ error: "Signup not found" }, 404);
  if (!(await Teams.isAcceptedMember(String(signup.team_id), user.id))) return json({ error: "Not a member of this team" }, 403);

  const challenge = await Challenges.getChallengeById(String(signup.challenge_id));
  if (!challenge) return json({ error: "Challenge not found" }, 404);

  try {
    if (challenge.type === "cohesion_test") {
      if (!signup.description) return json({ error: "Write your response first" }, 400);
      const review = await reviewCohesionSubmission(challenge.description ?? "", signup.description as string);
      await Challenges.saveAiReview(params.id, review);
      return json(review);
    }

    if (!signup.deck_url) return json({ error: "Upload a pitch deck first" }, 400);
    const pdfRes = await fetch(signup.deck_url as string);
    if (!pdfRes.ok) return json({ error: "Failed to fetch pitch deck from storage" }, 502);
    const bytes = new Uint8Array(await pdfRes.arrayBuffer());
    const base64 = btoa(String.fromCharCode(...bytes));
    const raw = await generateText(DECK_REVIEW_PROMPT, { inlineData: { mimeType: "application/pdf", data: base64 } });
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const review = JSON.parse(cleaned);
    await Challenges.saveAiReview(params.id, review);
    return json(review);
  } catch (err) {
    console.error(err);
    return json({ error: "AI returned an unexpected format. Please try again." }, 500);
  }
}

async function submitSignup(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Signup not found" }, 404);

  const signup = await Challenges.getSignupById(params.id) as Record<string, unknown> | null;
  if (!signup) return json({ error: "Signup not found" }, 404);
  if (!(await Teams.isAcceptedMember(String(signup.team_id), user.id))) return json({ error: "Not a member of this team" }, 403);

  const challenge = await Challenges.getChallengeById(String(signup.challenge_id));
  if (!challenge) return json({ error: "Challenge not found" }, 404);
  if (new Date(challenge.submission_deadline) <= new Date()) return json({ error: "Deadline has passed" }, 400);

  const body = await req.json().catch(() => ({}));
  const { description } = body as { description?: string };
  if (!description || !description.trim()) return json({ error: "description is required" }, 400);

  const mod = moderateText(description.trim());
  if (!mod.ok) return json({ error: `Description flagged by moderation: ${mod.reason}` }, 400);

  if (challenge.type === "hackathon" && (!signup.deck_url || !signup.video_url)) {
    return json({ error: "Upload a pitch deck and demo video before submitting" }, 400);
  }

  const updated = await Challenges.submitSignup(params.id, description.trim());

  if (challenge.type === "hackathon" && challenge.investor_id) {
    background(emitNotification(challenge.investor_id, "submission_received", challenge.id, { challengeId: challenge.id, teamId: signup.team_id }));
  }

  return json(updated);
}

async function getMySignups(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return json(await Challenges.getMySignups(user.id));
}

async function getChallengeSignups(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const challenge = await Challenges.getChallengeById(params.id);
  if (!challenge || challenge.investor_id !== user.id) return json({ error: "Not authorized" }, 403);
  return json(await Challenges.getChallengeSignups(params.id));
}

// ---------------------------------------------------------------------------
// Winner selection & offers
// ---------------------------------------------------------------------------

async function selectWinner(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const challenge = await Challenges.getChallengeById(params.id);
  if (!challenge || challenge.investor_id !== user.id) return json({ error: "Not authorized" }, 403);
  if (new Date(challenge.submission_deadline) > new Date()) return json({ error: "Deadline hasn't passed yet" }, 400);

  const body = await req.json().catch(() => ({}));
  const { teamId } = body as { teamId?: string };
  if (!teamId || !isNumericId(teamId)) return json({ error: "teamId is required" }, 400);

  const signup = await Challenges.getSignup(params.id, teamId) as Record<string, unknown> | null;
  if (!signup || signup.status !== "submitted") return json({ error: "That team has no submitted entry" }, 400);

  await Challenges.selectWinner(params.id, teamId);

  background((async () => {
    const memberIds = await Offers.getAcceptedMemberIds(teamId);
    for (const uid of memberIds) {
      await emitNotification(uid, "challenge_won", challenge.id, { challengeId: challenge.id, title: challenge.title });
    }
  })());

  return json({ ok: true });
}

function parseOfferInput(body: Record<string, unknown>): Offers.OfferInput | null {
  const amount = Number(body.amount);
  const equityPercent = Number(body.equityPercent);
  if (!Number.isFinite(amount) || !Number.isFinite(equityPercent)) return null;
  return {
    amount,
    equityPercent,
    valuation: body.valuation != null ? Number(body.valuation) : undefined,
    terms: typeof body.terms === "string" ? body.terms : undefined,
  };
}

async function createOffer(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const challenge = await Challenges.getChallengeById(params.id);
  if (!challenge || challenge.investor_id !== user.id) return json({ error: "Not authorized" }, 403);

  const body = await req.json().catch(() => ({}));
  const { teamId } = body as { teamId?: string };
  // winning_team_id comes back from Postgres as a string (bigint) — compare as strings, not === across types.
  if (!teamId || !isNumericId(teamId) || String(teamId) !== String(challenge.winning_team_id)) return json({ error: "teamId must be the selected winner" }, 400);

  const input = parseOfferInput(body);
  if (!input) return json({ error: "amount and equityPercent are required" }, 400);
  if (input.terms) {
    const mod = moderateText(input.terms);
    if (!mod.ok) return json({ error: `Terms flagged: ${mod.reason}` }, 400);
  }

  const existing = await Offers.currentRound(params.id, teamId);
  if (existing) return json({ error: "An offer already exists for this team" }, 409);

  const offer = await Offers.createInitialOffer(params.id, teamId, user.id, input);

  background((async () => {
    const memberIds = await Offers.getAcceptedMemberIds(teamId);
    for (const uid of memberIds) {
      await emitNotification(uid, "investment_offer", offer.id, { challengeId: params.id, round: offer.round });
    }
  })());

  return json(offer, 201);
}

async function counterOffer(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const { teamId } = body as { teamId?: string };
  if (!teamId || !isNumericId(teamId)) return json({ error: "teamId is required" }, 400);

  const input = parseOfferInput(body);
  if (!input) return json({ error: "amount and equityPercent are required" }, 400);
  if (input.terms) {
    const mod = moderateText(input.terms);
    if (!mod.ok) return json({ error: `Terms flagged: ${mod.reason}` }, 400);
  }

  const party = await Offers.resolveCallerParty(user, params.id, teamId);
  if (!party) return json({ error: "Not authorized on this negotiation" }, 403);

  const prev = await Offers.currentRound(params.id, teamId) as Record<string, unknown> | null;
  if (!prev) return json({ error: "No existing offer to counter — investor must create the first offer" }, 400);
  if (prev.status !== "pending") return json({ error: `Negotiation already ${prev.status}` }, 409);
  if (prev.direction === party) return json({ error: "Waiting on the other party to respond" }, 409);

  const offer = await Offers.insertCounterRound(params.id, teamId, prev.id as number, prev.round as number, party, user.id, input);

  background((async () => {
    if (party === "investor") {
      const memberIds = await Offers.getAcceptedMemberIds(teamId);
      for (const uid of memberIds) await emitNotification(uid, "investment_offer", offer.id, { challengeId: params.id, round: offer.round });
    } else {
      const challenge = await Challenges.getChallengeById(params.id);
      if (challenge?.investor_id) await emitNotification(challenge.investor_id, "investment_offer", offer.id, { challengeId: params.id, round: offer.round });
    }
  })());

  return json(offer, 201);
}

async function terminateOffer(req: Request, params: Record<string, string>, newStatus: "accepted" | "declined"): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const { teamId } = body as { teamId?: string };
  if (!teamId || !isNumericId(teamId)) return json({ error: "teamId is required" }, 400);

  const party = await Offers.resolveCallerParty(user, params.id, teamId);
  if (!party) return json({ error: "Not authorized on this negotiation" }, 403);

  const prev = await Offers.currentRound(params.id, teamId) as Record<string, unknown> | null;
  if (!prev) return json({ error: "No existing offer" }, 400);
  if (prev.status !== "pending") return json({ error: `Negotiation already ${prev.status}` }, 409);
  if (prev.direction === party) return json({ error: "Waiting on the other party to respond" }, 409);

  await Offers.setOfferStatus(prev.id as number, newStatus);

  background((async () => {
    const other = party === "investor" ? await Offers.getAcceptedMemberIds(teamId) : null;
    if (other) {
      for (const uid of other) await emitNotification(uid, "investment_offer", prev.id as number, { challengeId: params.id, status: newStatus });
    } else {
      const challenge = await Challenges.getChallengeById(params.id);
      if (challenge?.investor_id) await emitNotification(challenge.investor_id, "investment_offer", prev.id as number, { challengeId: params.id, status: newStatus });
    }
  })());

  return json({ ok: true, status: newStatus });
}

async function getOfferHistory(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!isNumericId(params.id)) return json({ error: "Challenge not found" }, 404);

  const url = new URL(req.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId || !isNumericId(teamId)) return json({ error: "teamId query param is required" }, 400);

  const party = await Offers.resolveCallerParty(user, params.id, teamId);
  if (!party) return json({ error: "Not authorized" }, 403);

  return json(await Offers.getOfferHistory(params.id, teamId));
}

serveFunction(FN, [
  route(FN, "POST", "/teams", createTeam),
  route(FN, "GET", "/teams/mine", getMyTeams),
  route(FN, "GET", "/teams/invites/mine", getMyPendingInvites),
  route(FN, "PUT", "/teams/:id", updateTeam),
  route(FN, "POST", "/teams/:id/invite", inviteToTeam),
  route(FN, "POST", "/teams/:id/respond", respondToInvite),
  route(FN, "POST", "/teams/:id/leave", leaveTeamHandler),
  route(FN, "GET", "/teams/:id", getTeam),

  route(FN, "POST", "/challenges/draft-description", draftDescription),
  route(FN, "GET", "/challenges/open", getOpenChallenges),
  route(FN, "GET", "/challenges/mine", getMyChallenges),
  route(FN, "POST", "/challenges", createChallenge),
  route(FN, "POST", "/challenges/:id/signup", signupForChallenge),
  route(FN, "GET", "/challenges/:id/signups", getChallengeSignups),
  route(FN, "POST", "/challenges/:id/select-winner", selectWinner),
  route(FN, "POST", "/challenges/:id/offers", createOffer),
  route(FN, "POST", "/challenges/:id/offers/counter", counterOffer),
  route(FN, "POST", "/challenges/:id/offers/accept", (req, p) => terminateOffer(req, p, "accepted")),
  route(FN, "POST", "/challenges/:id/offers/decline", (req, p) => terminateOffer(req, p, "declined")),
  route(FN, "GET", "/challenges/:id/offers", getOfferHistory),
  route(FN, "GET", "/challenges/:id", getChallenge),

  route(FN, "POST", "/signups/:id/upload-deck", (req, p) => uploadSignupFile(req, p, "deck")),
  route(FN, "POST", "/signups/:id/upload-video", (req, p) => uploadSignupFile(req, p, "video")),
  route(FN, "POST", "/signups/:id/ai-review", aiReviewSignup),
  route(FN, "POST", "/signups/:id/submit", submitSignup),
  route(FN, "GET", "/signups/mine", getMySignups),
]);
