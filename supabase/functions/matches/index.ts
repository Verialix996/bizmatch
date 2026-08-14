import { authenticate, requireAdmin } from "../_shared/auth.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { background } from "../_shared/background.ts";
import { recomputeMatchesForFounder } from "../_shared/matchRecompute.ts";
import { MatchesModel } from "./model.ts";

const FN = "matches";

function requireAdminOrSelf(userId: string, targetId: string, isAdmin: boolean): Response | null {
  if (isAdmin || userId === targetId) return null;
  return json({ error: "Forbidden" }, 403);
}

// GET /functions/v1/matches/top?founderId=&limit=  (admin or self — MVP screen 8)
async function topMatches(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const founderId = url.searchParams.get("founderId") ?? user.id;
  const forbidden = requireAdminOrSelf(user.id, founderId, user.role === "admin");
  if (forbidden) return forbidden;

  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10) || 10, 50);
  const matches = await MatchesModel.topMatches(founderId, limit);
  return json(matches);
}

// GET /functions/v1/matches/top-pairs?limit=&founderId=  (admin — Suggested
// Matches: cohort-wide ranked pairs, optionally scoped to one founder)
async function topPairs(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const adminErr = requireAdmin(user);
  if (adminErr) return adminErr;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 20) || 20, 50);
  const founderId = url.searchParams.get("founderId") || null;
  const pairs = await MatchesModel.topPairs(limit, founderId);
  return json(pairs);
}

// GET /functions/v1/matches/compare?a=&b=  (admin, or a founder comparing
// themselves against one of their own matches — used both by the admin
// Match Detail screen and the founder dashboard's "compare my matches"
// view, which calls this once per candidate with the founder as `a`.)
async function compare(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const a = url.searchParams.get("a");
  const b = url.searchParams.get("b");
  if (!a || !b) return json({ error: "a and b founder ids are required" }, 400);

  const isParty = user.id === a || user.id === b;
  if (user.role !== "admin" && !isParty) return json({ error: "Forbidden" }, 403);

  const detail = await MatchesModel.pairDetail(a, b);
  if (!detail) {
    return json({ error: "No compatibility computed for this pair yet — trigger a recompute first" }, 404);
  }
  return json(detail);
}

// POST /functions/v1/matches/recompute  (admin or self)  { founderId }
// Synchronous — used right after onboarding/profile edits so the Matching
// screen has fresh data on next load. Routine updates use the
// fire-and-forget `background()` hook instead (see evidence/assessments/
// peer-feedback, which call this same function after evidence-producing writes).
async function recompute(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const { founderId } = body as { founderId?: string };
  const targetId = founderId ?? user.id;
  const forbidden = requireAdminOrSelf(user.id, targetId, user.role === "admin");
  if (forbidden) return forbidden;

  await recomputeMatchesForFounder(targetId);
  return json({ ok: true });
}

serveFunction(FN, [
  route(FN, "GET", "/top", topMatches),
  route(FN, "GET", "/top-pairs", topPairs),
  route(FN, "GET", "/compare", compare),
  route(FN, "POST", "/recompute", recompute),
]);
