import { authenticate } from "../_shared/auth.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { computeFounderInsights, recomputeFounderDna } from "../_shared/dnaRecompute.ts";

const FN = "founder-dna";

// GET /functions/v1/founder-dna/:founderId  (admin or self — MVP screen 7,
// Founder Insights: bullets derived from evidence, distinct from the raw
// Founder Profile screen. Deliberately no single "Founder Score"; the
// frontend renders dimensions.*.score/confidence as bullet-point insights,
// not a radar chart, for the MVP.)
async function getFounderDna(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "admin" && user.id !== params.founderId) return json({ error: "Forbidden" }, 403);

  const insights = await computeFounderInsights(params.founderId);
  return json(insights);
}

// POST /functions/v1/founder-dna/:founderId/recompute  (admin — manual trigger)
async function postRecompute(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "Admin only" }, 403);

  await recomputeFounderDna(params.founderId);
  const insights = await computeFounderInsights(params.founderId);
  return json(insights);
}

serveFunction(FN, [
  route(FN, "GET", "/:founderId", getFounderDna),
  route(FN, "POST", "/:founderId/recompute", postRecompute),
]);
