import { authenticate, requireVerified } from "../_shared/auth.ts";
import { query } from "../_shared/db.ts";
import { json } from "../_shared/respond.ts";
import { route } from "../_shared/router.ts";
import { serveFunction } from "../_shared/serve.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";
import { getFeed, recordSwipe, getMatches } from "../_shared/matchModel.ts";

const FN = "match";
const DAILY_SWIPE_LIMIT = 20;

// GET /functions/v1/match/feed
async function feed(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const candidates = await getFeed(user.id, user.role as string);
  return json(candidates);
}

// POST /functions/v1/match/swipe  { targetUserId, direction, superLike }
async function swipe(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  const body = await req.json().catch(() => ({}));
  const { targetUserId, direction, superLike } = body as { targetUserId?: string; direction?: string; superLike?: boolean };

  if (!targetUserId || !["like", "pass"].includes(direction ?? "")) {
    return json({ error: "targetUserId and direction (like|pass) are required" }, 400);
  }
  if (targetUserId === user.id) return json({ error: "Cannot swipe on yourself" }, 400);

  const isPremium = user.is_premium && user.premium_expires_at && new Date(user.premium_expires_at as string) > new Date();

  if (!isPremium) {
    const countRows = await query<{ today_count: number }>(
      `SELECT CASE WHEN swipe_count_date = current_date THEN swipe_count ELSE 0 END AS today_count
       FROM user_activity WHERE user_id = $1`,
      [user.id],
    );
    const todayCount = countRows[0]?.today_count ?? 0;
    if (todayCount >= DAILY_SWIPE_LIMIT) {
      return json({ error: "Daily swipe limit reached", upgradeRequired: true }, 429);
    }
    await query(
      `INSERT INTO user_activity (user_id, swipe_count, swipe_count_date)
       VALUES ($1, 1, current_date)
       ON CONFLICT (user_id) DO UPDATE SET
         swipe_count = CASE WHEN user_activity.swipe_count_date = current_date
                            THEN user_activity.swipe_count + 1 ELSE 1 END,
         swipe_count_date = current_date`,
      [user.id],
    );
  }

  const isSuperLike = superLike === true && !!isPremium;
  const result = await recordSwipe(user.id, targetUserId, direction!, isSuperLike);
  return json(result);
}

// GET /functions/v1/match/matches
async function matches(req: Request): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  const verifyErr = requireVerified(user);
  if (verifyErr) return verifyErr;

  return json(await getMatches(user.id));
}

// GET /functions/v1/match/compatibility/:targetUserId
async function compatibility(req: Request, params: Record<string, string>): Promise<Response> {
  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const targetId = params.targetUserId;
  if (!targetId) return json({ error: "targetUserId required" }, 400);
  if (!isGeminiConfigured()) return json({ error: "AI unavailable" }, 503);

  const profileQuery = `
    SELECT u.name, u.role, u.bio, u.skills, ip.investment_domain, ip.preferred_stage, ip.max_investment,
           proj.stage AS venture_stage, proj.funding_needed AS funding_needs
    FROM users u
    LEFT JOIN investor_profiles ip ON ip.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT t.stage, t.funding_needed FROM team_members tm JOIN teams t ON t.id = tm.team_id AND t.is_active = true
      WHERE tm.user_id = u.id AND tm.status = 'accepted'
      ORDER BY t.created_at DESC LIMIT 1
    ) proj ON true
    WHERE u.id = $1`;

  const [viewerRows, targetRows] = await Promise.all([
    query<Record<string, unknown>>(profileQuery, [user.id]),
    query<Record<string, unknown>>(profileQuery, [targetId]),
  ]);

  const v = viewerRows[0];
  const t = targetRows[0];
  if (!v || !t) return json({ error: "User not found" }, 404);

  const skillsList = (s: unknown) => (Array.isArray(s) ? s.join(", ") : "");

  const prompt = `You are a business matchmaking AI. Analyze compatibility between two users and return ONLY valid JSON — no markdown, no explanation.
{"score":<0-100>,"pros":["...","..."],"cons":["...","..."]}

${v.name} (${v.role}): bio="${v.bio || ""}", skills="${skillsList(v.skills)}", stage=${v.venture_stage || v.preferred_stage || ""}, domain=${v.investment_domain || ""}, maxInvest=${v.max_investment || ""}, needsFunding=${v.funding_needs || ""}
${t.name} (${t.role}): bio="${t.bio || ""}", skills="${skillsList(t.skills)}", stage=${t.venture_stage || t.preferred_stage || ""}, domain=${t.investment_domain || ""}, maxInvest=${t.max_investment || ""}, needsFunding=${t.funding_needs || ""}

Provide 2-4 pros and 1-3 cons. Be specific and business-focused.`;

  let parsed: { score?: number; pros?: string[]; cons?: string[] };
  try {
    const raw = (await generateText(prompt)).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: "AI response parse error" }, 500);
  }

  const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
  const pros = Array.isArray(parsed.pros) ? parsed.pros : [];
  const cons = Array.isArray(parsed.cons) ? parsed.cons : [];

  return json({ score, pros, cons });
}

serveFunction(FN, [
  route(FN, "GET", "/feed", feed),
  route(FN, "POST", "/swipe", swipe),
  route(FN, "GET", "/matches", matches),
  route(FN, "GET", "/compatibility/:targetUserId", compatibility),
]);
