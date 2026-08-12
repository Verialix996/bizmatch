import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { FounderInterviewsModel } from "./model.ts";

const FN = "founder-interviews";

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

  await FounderInterviewsModel.complete(params.id);
  return json({ ok: true });
}

// DELETE /functions/v1/founder-interviews/:id  (admin)
async function deleteInterview(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

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
