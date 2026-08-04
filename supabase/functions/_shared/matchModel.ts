import { query } from "./db.ts";
import { generateText, isGeminiConfigured } from "./gemini.ts";
import { sendPushNotification, emitNotification } from "./notifications.ts";
import { background } from "./background.ts";

// Shared by both `match` (feed/swipe/matches) and `profile` (preScoreUser is
// fired in the background after profile create/update).

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

const STAGE_LADDER = ["idea", "mvp", "growth", "scale"];

function stageScore(stageA?: string | null, stageB?: string | null): number {
  const i = STAGE_LADDER.indexOf((stageA || "").toLowerCase());
  const j = STAGE_LADDER.indexOf((stageB || "").toLowerCase());
  if (i === -1 || j === -1) return 0;
  const diff = Math.abs(i - j);
  if (diff === 0) return 40;
  if (diff === 1) return 20;
  if (diff === 2) return 5;
  return 0;
}

function budgetScore(maxInvestment?: number | null, fundingNeeds?: number | null): number {
  if (maxInvestment == null || fundingNeeds == null || fundingNeeds === 0) return 0;
  const ratio = maxInvestment / fundingNeeds;
  if (ratio >= 1) return 30;
  if (ratio >= 0.75) return 20;
  if (ratio >= 0.5) return 10;
  return 0;
}

function jaccardScore(textA: string, textB: string, maxPts: number): number {
  const tokenize = (t: string) => new Set((t || "").toLowerCase().split(/[\s,;|]+/).filter(Boolean));
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return Math.round((intersection / union) * maxPts);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// deno-lint-ignore no-explicit-any
function completenessBonus(profile: any): number {
  let bonus = 0;
  if (profile.photo_url) bonus += 3;
  if ((profile.bio || "").length > 50) bonus += 4;
  if (asArray(profile.skills).length >= 2) bonus += 3;
  return bonus;
}

// deno-lint-ignore no-explicit-any
function scoreInvestorEntrepreneur(investorProfile: any, entrepreneurProfile: any, aiScore: number | null = null): number {
  let score = 0;
  if (aiScore != null) {
    score += Math.round(aiScore / 100 * 60);
    score += Math.round(stageScore(investorProfile.preferred_stage, entrepreneurProfile.venture_stage) / 40 * 20);
    score += Math.round(budgetScore(investorProfile.max_investment, entrepreneurProfile.funding_needs) / 30 * 10);
  } else {
    score += stageScore(investorProfile.preferred_stage, entrepreneurProfile.venture_stage);
    score += budgetScore(investorProfile.max_investment, entrepreneurProfile.funding_needs);
    const domainText = investorProfile.investment_domain || "";
    const entText = [...asArray(entrepreneurProfile.skills), entrepreneurProfile.bio || ""].join(" ");
    score += jaccardScore(domainText, entText as string, 30);
  }
  score += completenessBonus(entrepreneurProfile);
  return score;
}

// deno-lint-ignore no-explicit-any
function scoreEntrepreneurEntrepreneur(profileA: any, profileB: any, aiScore: number | null = null): number {
  let score = 0;
  if (aiScore != null) {
    score += Math.round(aiScore / 100 * 60);
  } else {
    const hobbiesA = (asArray(profileA.hobbies) as string[]).map((h) => h.toLowerCase());
    const hobbiesB = (asArray(profileB.hobbies) as string[]).map((h) => h.toLowerCase());
    const sharedHobbies = hobbiesA.filter((h) => hobbiesB.includes(h));
    score += sharedHobbies.length * 20;

    const skillsA = (asArray(profileA.skills) as string[]).map((s) => s.toLowerCase());
    const skillsB = (asArray(profileB.skills) as string[]).map((s) => s.toLowerCase());
    const complementary = skillsB.filter((s) => !skillsA.includes(s));
    score += complementary.length * 10;
  }
  score += completenessBonus(profileB);
  return score;
}

// ---------------------------------------------------------------------------
// AI scoring
// ---------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
function buildPersonPrompt(myRole: string, myProfile: any, candidate: any): string {
  if (myRole === "investor") {
    return `Rate investor-entrepreneur compatibility 0-100. Reply with ONLY a number.
Investor: domain=${myProfile.investment_domain || "N/A"}, preferred stage=${myProfile.preferred_stage || "N/A"}, max invest=$${myProfile.max_investment || 0}.
Entrepreneur: bio=${candidate.bio || "N/A"}, skills=${asArray(candidate.skills).join(", ") || "N/A"}, industry=${candidate.project_industry || "N/A"}, stage=${candidate.venture_stage || "N/A"}, needs=$${candidate.funding_needs || 0}.`;
  }
  return `Rate collaboration potential 0-100. Reply with ONLY a number.
Person A: bio=${myProfile.bio || "N/A"}, skills=${asArray(myProfile.skills).join(", ") || "N/A"}, hobbies=${asArray(myProfile.hobbies).join(", ") || "N/A"}.
Person B: bio=${candidate.bio || "N/A"}, skills=${asArray(candidate.skills).join(", ") || "N/A"}, hobbies=${asArray(candidate.hobbies).join(", ") || "N/A"}.`;
}

// deno-lint-ignore no-explicit-any
async function scoreOneCandidate(myRole: string, myProfile: any, candidate: any): Promise<number | null> {
  const raw = await generateText(buildPersonPrompt(myRole, myProfile, candidate));
  const score = parseInt(raw, 10);
  if (isNaN(score)) return null;
  return Math.max(0, Math.min(100, score));
}

// deno-lint-ignore no-explicit-any
async function ensureAiScores(userId: string, userRole: string, myProfile: any, candidates: any[], maxNew = 10): Promise<void> {
  if (!isGeminiConfigured() || !myProfile || candidates.length === 0) return;

  const candidateIds = candidates.map((c) => c.user_id);
  const cached = await query<{ candidate_id: string }>(
    "SELECT candidate_id FROM ai_match_scores WHERE user_id = $1 AND candidate_id = ANY($2::uuid[])",
    [userId, candidateIds],
  );
  const cachedSet = new Set(cached.map((r) => r.candidate_id));
  const uncached = candidates.filter((c) => !cachedSet.has(c.user_id)).slice(0, maxNew);
  if (uncached.length === 0) return;

  await Promise.allSettled(
    uncached.map(async (candidate) => {
      const clamped = await scoreOneCandidate(userRole, myProfile, candidate);
      if (clamped == null) return;
      await query(
        "INSERT INTO ai_match_scores (user_id, candidate_id, score) VALUES ($1, $2, $3) ON CONFLICT (user_id, candidate_id) DO NOTHING",
        [userId, candidate.user_id, clamped],
      );
    }),
  );
}

// Eager pre-scoring — called fire-and-forget on profile create/update.
export async function preScoreUser(userId: string): Promise<void> {
  if (!isGeminiConfigured()) return;

  const meRows = await query<Record<string, unknown>>(
    `SELECT u.role, u.bio, u.skills, u.hobbies,
            investor.investment_domain, investor.preferred_stage, investor.max_investment
     FROM users u
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  const me = meRows[0];
  if (!me) return;

  const candidates = await query<Record<string, unknown>>(
    `SELECT u.id AS user_id, u.bio, u.skills, u.hobbies, u.photo_url,
            proj.stage AS venture_stage, proj.funding_needed AS funding_needs, proj.industry AS project_industry
     FROM users u
     LEFT JOIN LATERAL (
       SELECT p.stage, p.funding_needed, p.industry
       FROM projects p WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) proj ON true
     WHERE u.role = 'entrepreneur' AND u.deleted_at IS NULL AND u.id != $1`,
    [userId],
  );
  if (!candidates.length) return;

  await query("DELETE FROM ai_match_scores WHERE user_id = $1", [userId]);

  for (let i = 0; i < candidates.length; i += 10) {
    const batch = candidates.slice(i, i + 10);
    await Promise.allSettled(batch.map(async (candidate) => {
      const clamped = await scoreOneCandidate(me.role as string, me, candidate);
      if (clamped == null) return;
      await query(
        "INSERT INTO ai_match_scores (user_id, candidate_id, score) VALUES ($1, $2, $3) ON CONFLICT (user_id, candidate_id) DO NOTHING",
        [userId, candidate.user_id, clamped],
      );
    }));
  }
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export async function getFeed(userId: string, userRole: string, mode = "investors", projectId: string | number | null = null, limit = 20) {
  const allSwiped = await query<{ swiped_id: string; direction: string }>(
    "SELECT swiped_id, direction FROM swipes WHERE swiper_id = $1",
    [userId],
  );

  const passedIds = allSwiped.filter((r) => r.direction === "pass").map((r) => r.swiped_id);
  const likedIds = allSwiped.filter((r) => r.direction === "like").map((r) => r.swiped_id);
  const excludeIds = [userId, ...likedIds];

  // Investors only ever browse entrepreneurs; entrepreneurs browse investors by
  // default ("investors" mode) or other entrepreneurs ("partners" mode, i.e.
  // co-founder search).
  const roleFilter = (mode === "partners" || userRole === "investor") ? "entrepreneur" : "investor";

  const candidates = await query<Record<string, unknown>>(
    `SELECT u.id AS user_id, u.name, u.photo_url, u.is_premium, u.premium_expires_at,
            u.bio, u.skills, u.hobbies, u.role AS role_type,
            investor.investment_domain, investor.preferred_stage, investor.max_investment,
            proj.stage AS venture_stage, proj.funding_needed AS funding_needs, proj.industry AS project_industry
     FROM users u
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT p.stage, p.funding_needed, p.industry
       FROM projects p WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) proj ON true
     WHERE u.role = $2
       AND u.deleted_at IS NULL
       AND u.id != ALL($1::uuid[])`,
    [excludeIds, roleFilter],
  );

  const myProfileRows = await query<Record<string, unknown>>(
    `SELECT u.id, u.role, u.photo_url, u.bio, u.skills, u.hobbies,
            investor.investment_domain, investor.preferred_stage, investor.max_investment
     FROM users u
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );
  const myProfile = myProfileRows[0];

  // If the entrepreneur selected a specific project, score investor candidates
  // against that project's specifics rather than their overall profile.
  let selectedProject: Record<string, unknown> | null = null;
  if (projectId && userRole === "entrepreneur") {
    const pRows = await query<Record<string, unknown>>(
      "SELECT stage, funding_needed FROM projects WHERE id = $1 AND user_id = $2 AND is_active = true",
      [projectId, userId],
    );
    selectedProject = pRows[0] || null;
  }

  await Promise.race([
    ensureAiScores(userId, userRole, myProfile, candidates, 10),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]).catch(() => {});

  const aiScoreMap = new Map<string, number>();
  if (candidates.length > 0) {
    const cIds = candidates.map((c) => c.user_id);
    const aiRows = await query<{ candidate_id: string; score: number }>(
      "SELECT candidate_id, score FROM ai_match_scores WHERE user_id = $1 AND candidate_id = ANY($2::uuid[])",
      [userId, cIds],
    );
    aiRows.forEach((r) => aiScoreMap.set(r.candidate_id, r.score));
  }

  // deno-lint-ignore no-explicit-any
  const toCard = (c: any, score: number) => ({
    userId: c.user_id,
    name: c.name,
    photoUrl: c.photo_url,
    isPremium: !!(c.is_premium && c.premium_expires_at && new Date(c.premium_expires_at) > new Date()),
    role: c.role_type,
    bio: c.bio,
    skills: asArray(c.skills),
    hobbies: asArray(c.hobbies),
    ventureStage: c.venture_stage,
    fundingNeeds: c.funding_needs,
    investmentDomain: c.investment_domain,
    preferredStage: c.preferred_stage,
    maxInvestment: c.max_investment,
    score,
    aiScore: aiScoreMap.get(c.user_id) ?? null,
  });

  // deno-lint-ignore no-explicit-any
  const calcScore = (c: any) => {
    const aiScore = aiScoreMap.has(c.user_id) ? aiScoreMap.get(c.user_id)! : null;
    if (!myProfile) return 0;
    if (userRole === "investor" && c.role_type === "entrepreneur") {
      return scoreInvestorEntrepreneur(myProfile, c, aiScore);
    }
    if (userRole === "entrepreneur" && c.role_type === "investor") {
      if (selectedProject) {
        const projectProxy = { ...myProfile, venture_stage: selectedProject.stage, funding_needs: selectedProject.funding_needed };
        return scoreInvestorEntrepreneur(c, projectProxy, aiScore);
      }
      return scoreInvestorEntrepreneur(c, myProfile, aiScore);
    }
    if (userRole === "entrepreneur" && c.role_type === "entrepreneur") {
      return scoreEntrepreneurEntrepreneur(myProfile, c, aiScore);
    }
    return userRole === "investor"
      ? scoreInvestorEntrepreneur(myProfile, c, aiScore)
      : scoreEntrepreneurEntrepreneur(myProfile, c, aiScore);
  };

  const fresh = candidates.filter((c) => !passedIds.includes(c.user_id as string));
  const passed = candidates.filter((c) => passedIds.includes(c.user_id as string));

  // deno-lint-ignore no-explicit-any
  const scoreAndSort = (arr: any[]) => arr.map((c) => toCard(c, calcScore(c))).sort((a, b) => b.score - a.score);

  return [...scoreAndSort(fresh), ...scoreAndSort(passed)].slice(0, limit);
}

// ---------------------------------------------------------------------------
// Swipe
// ---------------------------------------------------------------------------

export async function recordSwipe(swiperId: string, swipedId: string, direction: string, isSuperLike = false) {
  await query(
    `INSERT INTO swipes (swiper_id, swiped_id, direction, is_super_like)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (swiper_id, swiped_id) DO UPDATE SET
       direction = EXCLUDED.direction, is_super_like = EXCLUDED.is_super_like, created_at = now()`,
    [swiperId, swipedId, direction, isSuperLike],
  );

  if (direction !== "like") return { matched: false };

  const theirSwipe = await query(
    `SELECT direction FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'like'`,
    [swipedId, swiperId],
  );
  if (!theirSwipe[0]) return { matched: false };

  const [u1, u2] = swiperId < swipedId ? [swiperId, swipedId] : [swipedId, swiperId];

  await query(
    "INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT (user1_id, user2_id) DO NOTHING",
    [u1, u2],
  );

  const matchRows = await query<{ id: number }>(
    "SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2",
    [u1, u2],
  );
  const matchId = matchRows[0]?.id ?? null;

  if (matchId) {
    background((async () => {
      const rows = await query<{ name: string }>("SELECT name FROM users WHERE id = $1", [swiperId]);
      const name = rows[0]?.name || "Someone";
      await sendPushNotification(swipedId, "🎉 New Match!", `You matched with ${name}!`, { matchId });
      await emitNotification(swipedId, "match", matchId, { matchId, name });
    })());
    if (isSuperLike) {
      background((async () => {
        const rows = await query<{ name: string }>("SELECT name FROM users WHERE id = $1", [swiperId]);
        // ref_id is a bigint column — pass matchId, not swiperId (a uuid), which
        // silently fails the insert (caught in emitNotification's try/catch).
        await emitNotification(swipedId, "super_like", matchId, { fromUserId: swiperId, matchId, name: rows[0]?.name || "Someone" });
      })());
    }
  }

  return { matched: true, matchId };
}

// ---------------------------------------------------------------------------
// Matches list
// ---------------------------------------------------------------------------

export async function getMatches(userId: string) {
  return await query(
    `SELECT
       m.id AS "matchId",
       m.created_at AS "matchedAt",
       u.id AS "userId",
       u.name,
       u.photo_url AS "photoUrl",
       u.role,
       u.bio,
       u.role AS "roleType",
       investor.investment_domain AS "investmentDomain",
       proj.stage AS "ventureStage"
     FROM matches m
     JOIN users u ON u.id = CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END
     LEFT JOIN investor_profiles investor ON investor.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT p.stage FROM projects p
       WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) proj ON true
     WHERE (m.user1_id = $1 OR m.user2_id = $1)
       AND u.deleted_at IS NULL
     ORDER BY m.created_at DESC`,
    [userId],
  );
}
