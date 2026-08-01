import { authenticate, requireVerified } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { moderateText } from "../_shared/moderation.ts";
import { uploadBuffer, BUCKETS } from "../_shared/storage.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";
import { createProject, getProjectsByUser, getProjectById, updateProject, deleteProject } from "./model.ts";

const FN = "projects";
const MB = 1024 * 1024;

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

If the document is NOT a business pitch deck (e.g. it is a spreadsheet, equation, academic paper, or unrelated content), set overallScore to 1 and state clearly in weaknesses that this does not appear to be a pitch deck.

Respond ONLY with valid JSON, no markdown:
{"strengths":["..."],"weaknesses":["..."],"suggestions":["..."],"overallScore":7}`;

// POST /functions/v1/projects/:id/upload-deck
async function uploadDeck(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const form = await req.formData();
  const file = form.get("deck") as File | null;
  if (!file) return json({ error: "No file uploaded" }, 400);
  if (file.size > 20 * MB) return json({ error: "File too large" }, 413);

  const buffer = new Uint8Array(await file.arrayBuffer());
  const url = await uploadBuffer(BUCKETS.deck, `${user.id}/${params.id}-${Date.now()}.pdf`, buffer, "application/pdf");
  await query("UPDATE projects SET deck_url = $1 WHERE id = $2 AND user_id = $3", [url, params.id, user.id]);
  return json({ deck_url: url });
}

// POST /functions/v1/projects/:id/upload-video
async function uploadVideo(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const form = await req.formData();
  const file = form.get("video") as File | null;
  if (!file) return json({ error: "No file uploaded" }, 400);
  if (file.size > 100 * MB) return json({ error: "File too large" }, 413);

  const buffer = new Uint8Array(await file.arrayBuffer());
  const url = await uploadBuffer(BUCKETS.video, `${user.id}/${params.id}-${Date.now()}.mp4`, buffer, file.type || "video/mp4");
  await query("UPDATE projects SET video_url = $1 WHERE id = $2 AND user_id = $3", [url, params.id, user.id]);
  return json({ video_url: url });
}

// GET /functions/v1/projects/mine
async function mine(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  return json(await getProjectsByUser(user.id));
}

// GET /functions/v1/projects/:id
async function getOne(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  if (!/^\d+$/.test(params.id)) return json({ error: "Project not found" }, 404);
  const project = await getProjectById(params.id);
  if (!project) return json({ error: "Project not found" }, 404);
  return json(project);
}

// POST /functions/v1/projects
async function create(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  if (user.role !== "entrepreneur") return json({ error: "Only entrepreneurs can create projects" }, 403);

  const body = await req.json().catch(() => ({}));
  const { title, description } = body as { title?: string; description?: string };
  if (!title) return json({ error: "title is required" }, 400);

  const titleMod = moderateText(title);
  if (!titleMod.ok) return json({ error: `Title flagged by moderation: ${titleMod.reason}` }, 400);
  if (description) {
    const mod = moderateText(description);
    if (!mod.ok) return json({ error: `Description flagged by moderation: ${mod.reason}` }, 400);
  }

  const project = await createProject(user.id, body);
  return json(project, 201);
}

// PUT /functions/v1/projects/:id
async function update(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const body = await req.json().catch(() => ({}));
  const { title, description } = body as { title?: string; description?: string };
  if (!title) return json({ error: "title is required" }, 400);

  const titleMod = moderateText(title);
  if (!titleMod.ok) return json({ error: `Title flagged by moderation: ${titleMod.reason}` }, 400);
  if (description) {
    const mod = moderateText(description);
    if (!mod.ok) return json({ error: `Description flagged by moderation: ${mod.reason}` }, 400);
  }

  const project = await updateProject(params.id, user.id, body);
  return json(project);
}

// DELETE /functions/v1/projects/:id
async function remove(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  await deleteProject(params.id, user.id);
  return json({ message: "Project removed" });
}

// POST /functions/v1/projects/:id/deck-review
async function reviewDeck(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  if (!isGeminiConfigured()) return json({ error: "AI review not configured" }, 503);

  const rows = await query<{ deck_url: string | null }>(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    [params.id, user.id],
  );
  if (!rows[0]) return json({ error: "Project not found or not yours" }, 403);
  if (!rows[0].deck_url) return json({ error: "Upload a pitch deck first" }, 400);

  const deckUrl = rows[0].deck_url;
  const pdfRes = await fetch(deckUrl);
  if (!pdfRes.ok) return json({ error: "Failed to fetch pitch deck from storage" }, 502);
  const bytes = new Uint8Array(await pdfRes.arrayBuffer());
  const base64 = btoa(String.fromCharCode(...bytes));

  let raw: string;
  try {
    raw = await generateText(DECK_REVIEW_PROMPT, { inlineData: { mimeType: "application/pdf", data: base64 } });
  } catch (err) {
    console.error(err);
    return json({ error: "AI returned an unexpected format. Please try again." }, 500);
  }

  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return json(JSON.parse(cleaned));
  } catch {
    return json({ error: "AI returned an unexpected format. Please try again." }, 500);
  }
}

// GET /functions/v1/projects/:id/deck — proxy from Supabase Storage with correct Content-Type
async function serveDeck(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const rows = await query<{ deck_url: string | null }>("SELECT deck_url FROM projects WHERE id = $1", [params.id]);
  if (!rows[0]) return json({ error: "Project not found" }, 404);
  const deckUrl = rows[0].deck_url;
  if (!deckUrl) return json({ error: "No pitch deck uploaded" }, 404);

  const response = await fetch(deckUrl);
  if (!response.ok) return json({ error: "Failed to fetch deck from storage" }, 502);
  const buf = await response.arrayBuffer();
  return new Response(buf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pitch-deck.pdf"',
    },
  });
}

serveFunction(FN, [
  route(FN, "GET", "/mine", mine),
  route(FN, "POST", "/:id/upload-deck", uploadDeck),
  route(FN, "POST", "/:id/upload-video", uploadVideo),
  route(FN, "POST", "/:id/deck-review", reviewDeck),
  route(FN, "GET", "/:id/deck", serveDeck),
  route(FN, "GET", "/:id", getOne),
  route(FN, "POST", "", create),
  route(FN, "PUT", "/:id", update),
  route(FN, "DELETE", "/:id", remove),
]);
