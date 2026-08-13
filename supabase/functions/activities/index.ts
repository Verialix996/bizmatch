import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { ActivitiesModel } from "./model.ts";

const FN = "activities";
const ACTIVITY_TYPES = ["hackathon", "workshop", "interview", "team_challenge", "work_trial"];

// GET /functions/v1/activities?programId=  (admin: full roster w/ filters.
// Founder: scoped to activities open for signup plus ones they're already
// registered for — see ActivitiesModel.listForFounder.)
async function listActivities(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const teamIdParam = url.searchParams.get("teamId");

  if (user.role !== "admin") {
    const activities = await ActivitiesModel.listForFounder(user.id, teamIdParam ? Number(teamIdParam) : null);
    return json(activities);
  }

  const programIdParam = url.searchParams.get("programId");
  const founderIdParam = url.searchParams.get("founderId");
  const activities = await ActivitiesModel.list(
    programIdParam ? Number(programIdParam) : null,
    teamIdParam ? Number(teamIdParam) : null,
    founderIdParam || null,
  );
  return json(activities);
}

// GET /functions/v1/activities/:id — a founder can only view an activity
// that's open for signup ('upcoming'), one they already have a participant
// row for (pending/approved/rejected), or one scoped to a team they're on;
// anything else 404s so browsing by guessing an id can't leak an activity
// they're not part of.
async function getActivity(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const activity = await ActivitiesModel.get(Number(params.id), user.id);
  if (!activity) return json({ error: "Activity not found" }, 404);
  if (user.role !== "admin" && activity.status !== "upcoming" && !activity.myStatus) {
    const onTeam = activity.team_id ? await ActivitiesModel.isFounderOnTeam(Number(activity.team_id), user.id) : false;
    if (!onTeam) return json({ error: "Activity not found" }, 404);
  }
  return json(activity);
}

// POST /functions/v1/activities/:id/register  (founder — request to join)
async function registerForActivity(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const result = await ActivitiesModel.requestJoin(Number(params.id), user.id);
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ status: result.status });
}

// PATCH /functions/v1/activities/:id/participants/:founderId  (admin)  { status: 'approved'|'rejected' }
async function decideParticipant(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };
  if (status !== "approved" && status !== "rejected") return json({ error: "status must be 'approved' or 'rejected'" }, 400);

  await ActivitiesModel.decideParticipant(Number(params.id), params.founderId, status);
  return json({ ok: true });
}

// POST /functions/v1/activities  (admin)  { programId?, type, title, description?, scheduledAt? }
async function createActivity(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { type, title } = body as { type?: string; title?: string };
  if (!type || !ACTIVITY_TYPES.includes(type)) return json({ error: `type must be one of ${ACTIVITY_TYPES.join(", ")}` }, 400);
  if (!title) return json({ error: "title is required" }, 400);

  const id = await ActivitiesModel.create(body);
  return json({ id }, 201);
}

// PATCH /functions/v1/activities/:id  (admin)
async function updateActivity(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  await ActivitiesModel.update(Number(params.id), body);
  return json({ ok: true });
}

// PUT /functions/v1/activities/:id/participants  (admin)  { founderIds: string[] }
async function setParticipants(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { founderIds } = body as { founderIds?: string[] };
  await ActivitiesModel.setParticipants(Number(params.id), founderIds ?? []);
  return json({ ok: true });
}

// PUT /functions/v1/activities/:id/evaluators  (admin)  { evaluatorIds: string[] }
async function setEvaluators(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const body = await req.json().catch(() => ({}));
  const { evaluatorIds } = body as { evaluatorIds?: string[] };
  await ActivitiesModel.setEvaluators(Number(params.id), evaluatorIds ?? []);
  return json({ ok: true });
}

// DELETE /functions/v1/activities/:id  (admin)
async function deleteActivity(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  await ActivitiesModel.remove(Number(params.id));
  return json({ ok: true });
}

serveFunction(FN, [
  route(FN, "GET", "", listActivities),
  route(FN, "POST", "", createActivity),
  route(FN, "GET", "/:id", getActivity),
  route(FN, "PATCH", "/:id", updateActivity),
  route(FN, "POST", "/:id/register", registerForActivity),
  route(FN, "PUT", "/:id/participants", setParticipants),
  route(FN, "PATCH", "/:id/participants/:founderId", decideParticipant),
  route(FN, "PUT", "/:id/evaluators", setEvaluators),
  route(FN, "DELETE", "/:id", deleteActivity),
]);
