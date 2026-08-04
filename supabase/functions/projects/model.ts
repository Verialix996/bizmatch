import { query } from "../_shared/db.ts";
import { generateText, isGeminiConfigured } from "../_shared/gemini.ts";
import { sendPushNotification } from "../_shared/notifications.ts";

const PROJECT_COLS = "id, user_id, title, description, stage, funding_needed, industry, visibility, icon_url, deck_url, video_url, is_active, created_at, updated_at";

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value as string[] : [];
}

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

function budgetScore(maxInvestment?: number | null, fundingNeeded?: number | null): number {
  if (maxInvestment == null || fundingNeeded == null || fundingNeeded === 0) return 0;
  const ratio = maxInvestment / fundingNeeded;
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

// deno-lint-ignore no-explicit-any
async function ensureAiProjectScores(investorId: string, investorProfile: any, projects: any[]): Promise<void> {
  if (!isGeminiConfigured() || !investorProfile || !projects.length) return;

  const projectIds = projects.map((p) => p.id);
  const cached = await query<{ project_id: number }>(
    "SELECT project_id FROM ai_project_scores WHERE investor_id = $1 AND project_id = ANY($2::bigint[])",
    [investorId, projectIds],
  );
  const cachedSet = new Set(cached.map((r) => r.project_id));
  const uncached = projects.filter((p) => !cachedSet.has(p.id)).slice(0, 10);
  if (!uncached.length) return;

  await Promise.allSettled(uncached.map(async (p) => {
    const prompt = `Rate investor-project fit 0-100. Reply with ONLY a number.
Investor: domain=${investorProfile.investment_domain || "N/A"}, preferred stage=${investorProfile.preferred_stage || "N/A"}, max invest=$${investorProfile.max_investment || 0}.
Project: industry=${p.industry || "N/A"}, stage=${p.stage || "N/A"}, funding needed=$${p.funding_needed || 0}, description=${(p.description || "").slice(0, 200)}, owner skills=${asArray(p.owner_skills).join(", ") || "N/A"}.`;
    const raw = await generateText(prompt);
    const score = parseInt(raw, 10);
    if (isNaN(score)) return;
    const clamped = Math.max(0, Math.min(100, score));
    await query(
      "INSERT INTO ai_project_scores (investor_id, project_id, score) VALUES ($1, $2, $3) ON CONFLICT (investor_id, project_id) DO NOTHING",
      [investorId, p.id, clamped],
    );
  }));
}

export async function createProject(userId: string, data: Record<string, unknown>) {
  const { title, description, stage, funding_needed, industry, visibility, icon_url, deck_url, video_url } = data as Record<string, string | number | null>;
  const rows = await query(
    `INSERT INTO projects (user_id, title, description, stage, funding_needed, industry, visibility, icon_url, deck_url, video_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${PROJECT_COLS}`,
    [userId, title, description || null, stage || null, funding_needed || null,
      industry || null, visibility || "public", icon_url || null, deck_url || null, video_url || null],
  );
  return rows[0];
}

export async function getProjectsByUser(userId: string) {
  return await query(
    `SELECT ${PROJECT_COLS} FROM projects WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`,
    [userId],
  );
}

export async function getProjectById(id: string | number) {
  const rows = await query(`SELECT ${PROJECT_COLS} FROM projects WHERE id = $1`, [id]);
  return rows[0] || null;
}

export async function updateProject(id: string | number, userId: string, data: Record<string, unknown>) {
  const { title, description, stage, funding_needed, industry, visibility, deck_url, video_url } = data as Record<string, string | number | null>;
  const rows = await query(
    `UPDATE projects
     SET title = $1, description = $2, stage = $3, funding_needed = $4,
         industry = $5, visibility = $6, deck_url = $7, video_url = $8, updated_at = now()
     WHERE id = $9 AND user_id = $10
     RETURNING ${PROJECT_COLS}`,
    [title, description || null, stage || null, funding_needed || null,
      industry || null, visibility || "public", deck_url || null, video_url || null, id, userId],
  );
  return rows[0] || null;
}

export async function deleteProject(id: string | number, userId: string) {
  await query("UPDATE projects SET is_active = false WHERE id = $1 AND user_id = $2", [id, userId]);
}

// ── Feed for investors ──────────────────────────────────────────────────────

export async function getProjectFeed(investorId: string, limit = 20) {
  const swipedRows = await query<{ project_id: number }>(
    "SELECT project_id FROM project_swipes WHERE investor_id = $1",
    [investorId],
  );
  const swiped = swipedRows.map((r) => r.project_id);

  const investorProfileRows = await query<Record<string, unknown>>(
    `SELECT ip.investment_domain, ip.preferred_stage, ip.max_investment
     FROM users u
     LEFT JOIN investor_profiles ip ON ip.user_id = u.id
     WHERE u.id = $1`,
    [investorId],
  );
  const investorProfile = investorProfileRows[0];

  const projects = await query<Record<string, unknown>>(
    `SELECT p.id, p.user_id, p.title, p.description, p.stage, p.funding_needed,
            p.industry, p.visibility, p.icon_url, p.deck_url, p.video_url, p.is_active,
            p.created_at, p.updated_at,
            u.name AS owner_name, u.photo_url AS owner_photo,
            u.is_premium AS owner_is_premium, u.premium_expires_at AS owner_premium_expires_at,
            u.bio AS owner_bio, u.skills AS owner_skills
     FROM projects p
     JOIN users u ON u.id = p.user_id
     WHERE p.is_active = true
       AND p.visibility = 'public'
       AND u.role = 'entrepreneur'
       AND u.deleted_at IS NULL
       AND p.user_id != $1
       AND p.id != ALL($2::bigint[])
       AND p.user_id NOT IN (
         SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END
         FROM matches WHERE user1_id = $1 OR user2_id = $1
       )`,
    [investorId, swiped],
  );

  await Promise.race([
    ensureAiProjectScores(investorId, investorProfile, projects),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]).catch(() => {});

  const aiScoreMap = new Map<number, number>();
  if (projects.length > 0) {
    const pIds = projects.map((p) => p.id);
    const aiRows = await query<{ project_id: number; score: number }>(
      "SELECT project_id, score FROM ai_project_scores WHERE investor_id = $1 AND project_id = ANY($2::bigint[])",
      [investorId, pIds],
    );
    aiRows.forEach((r) => aiScoreMap.set(r.project_id, r.score));
  }

  const scored = projects.map((p) => {
    let score = 0;
    const aiScore = aiScoreMap.get(p.id as number) ?? null;
    if (aiScore != null) {
      score += Math.round(aiScore / 100 * 60);
      score += Math.round(stageScore(investorProfile?.preferred_stage as string, p.stage as string) / 40 * 20);
      score += Math.round(budgetScore(investorProfile?.max_investment as number, p.funding_needed as number) / 30 * 10);
      if (p.deck_url) score += 5;
      if (p.video_url) score += 5;
    } else if (investorProfile) {
      score += stageScore(investorProfile.preferred_stage as string, p.stage as string);
      score += budgetScore(investorProfile.max_investment as number, p.funding_needed as number);
      const entText = [p.industry || "", ...asArray(p.owner_skills), p.owner_bio || ""].join(" ");
      score += jaccardScore((investorProfile.investment_domain as string) || "", entText as string, 30);
      if (p.deck_url) score += 10;
      if (p.video_url) score += 10;
    }
    return {
      projectId: p.id,
      userId: p.user_id,
      ownerName: p.owner_name,
      ownerPhoto: p.owner_photo,
      ownerBio: p.owner_bio,
      ownerSkills: asArray(p.owner_skills),
      isPremium: !!(p.owner_is_premium && p.owner_premium_expires_at && new Date(p.owner_premium_expires_at as string) > new Date()),
      title: p.title,
      description: p.description,
      stage: p.stage,
      fundingNeeded: p.funding_needed,
      industry: p.industry,
      deckUrl: p.deck_url,
      videoUrl: p.video_url,
      aiScore,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Swipe on a project ──────────────────────────────────────────────────────

export async function swipeProject(investorId: string, projectId: string | number, direction: string) {
  const projectRows = await query<Record<string, unknown>>(
    `SELECT ${PROJECT_COLS} FROM projects WHERE id = $1 AND is_active = true`,
    [projectId],
  );
  const project = projectRows[0];
  if (!project) return { error: "Project not found" };
  if (project.user_id === investorId) return { error: "Cannot swipe own project" };

  await query(
    `INSERT INTO project_swipes (investor_id, project_id, direction) VALUES ($1, $2, $3)
     ON CONFLICT (investor_id, project_id) DO UPDATE SET direction = excluded.direction`,
    [investorId, projectId, direction],
  );

  if (direction !== "like") return { matched: false };

  const entSwipeRows = await query(
    "SELECT id FROM swipes WHERE swiper_id = $1 AND swiped_id = $2 AND direction = 'like'",
    [project.user_id, investorId],
  );

  if (!entSwipeRows[0]) {
    query<{ name: string }>("SELECT name FROM users WHERE id = $1", [investorId]).then((rows) => {
      sendPushNotification(
        project.user_id as string,
        "👀 Investor Interest",
        `${rows[0]?.name || "An investor"} is interested in your project!`,
        { type: "investor_liked" },
      );
      sendPushNotification(
        investorId,
        "✅ Interest Registered",
        `Your interest in "${project.title}" has been sent to the entrepreneur!`,
        { type: "interest_sent", projectId: project.id },
      );
    }).catch(() => {});
    return { matched: false };
  }

  await query(
    "INSERT INTO project_matches (investor_id, project_id, user_id) VALUES ($1, $2, $3) ON CONFLICT (investor_id, project_id) DO NOTHING",
    [investorId, projectId, project.user_id],
  );

  const userId = project.user_id as string;
  const [u1, u2] = investorId < userId ? [investorId, userId] : [userId, investorId];
  await query(
    "INSERT INTO matches (user1_id, user2_id) VALUES ($1, $2) ON CONFLICT (user1_id, user2_id) DO NOTHING",
    [u1, u2],
  );

  const matchRows = await query<{ id: number }>(
    "SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2",
    [u1, u2],
  );

  query<{ name: string }>("SELECT name FROM users WHERE id = $1", [investorId]).then((rows) => {
    sendPushNotification(
      userId,
      "🎉 It's a Match!",
      `You matched with ${rows[0]?.name || "an investor"}!`,
      { matchId: matchRows[0]?.id },
    );
  }).catch(() => {});

  return { matched: true, matchId: matchRows[0]?.id ?? null, projectTitle: project.title, entrepreneurId: project.user_id };
}

// ── Matches ──────────────────────────────────────────────────────────────────

export async function getProjectMatches(userId: string, role: string) {
  if (role === "investor") {
    return await query(
      `SELECT pm.*, p.title, p.description, p.stage, p.funding_needed, p.industry,
              p.deck_url, p.video_url,
              u.name AS owner_name, u.photo_url AS owner_photo
       FROM project_matches pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE pm.investor_id = $1
       ORDER BY pm.created_at DESC`,
      [userId],
    );
  }
  return await query(
    `SELECT pm.*, p.title, p.description,
            u.name AS investor_name, u.photo_url AS investor_photo,
            u.bio AS investor_bio, ip.investment_domain
     FROM project_matches pm
     JOIN projects p ON p.id = pm.project_id
     JOIN users u ON u.id = pm.investor_id
     LEFT JOIN investor_profiles ip ON ip.user_id = pm.investor_id
     WHERE p.user_id = $1
     ORDER BY pm.created_at DESC`,
    [userId],
  );
}

// ── Partners ─────────────────────────────────────────────────────────────────

export async function getProjectPartners(projectId: string | number) {
  const rows = await query<Record<string, unknown>>(
    `SELECT team.user_id, u.name, u.photo_url, u.bio, u.role AS role_type, u.skills,
            team.is_owner, team.role AS project_role
     FROM (
       SELECT user_id, true AS is_owner, 'owner' AS role FROM projects WHERE id = $1
       UNION ALL
       SELECT pp.user_id, false AS is_owner, pp.role FROM project_partners pp WHERE pp.project_id = $1
     ) AS team
     JOIN users u ON u.id = team.user_id
     ORDER BY team.is_owner DESC`,
    [projectId],
  );
  return rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    photoUrl: r.photo_url,
    bio: r.bio,
    roleType: r.role_type,
    role: r.project_role,
    skills: asArray(r.skills),
    isOwner: !!r.is_owner,
  }));
}

export async function addProjectPartner(projectId: string | number, ownerUserId: string, partnerUserId: string, role = "member") {
  const rows = await query(`SELECT ${PROJECT_COLS} FROM projects WHERE id = $1 AND user_id = $2`, [projectId, ownerUserId]);
  if (!rows[0]) return { error: "Project not found or not yours" };
  if (partnerUserId === ownerUserId) return { error: "Cannot add yourself as partner" };
  const safeRole = (role || "member").trim().slice(0, 100);
  await query(
    "INSERT INTO project_partners (project_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (project_id, user_id) DO NOTHING",
    [projectId, partnerUserId, safeRole],
  );
  return { ok: true };
}

export async function updatePartnerRole(projectId: string | number, ownerUserId: string, partnerUserId: string, role: string) {
  const rows = await query(`SELECT ${PROJECT_COLS} FROM projects WHERE id = $1 AND user_id = $2`, [projectId, ownerUserId]);
  if (!rows[0]) return { error: "Project not found or not yours" };
  const safeRole = (role || "member").trim().slice(0, 100);
  await query("UPDATE project_partners SET role = $1 WHERE project_id = $2 AND user_id = $3", [safeRole, projectId, partnerUserId]);
  return { ok: true };
}

export async function removeProjectPartner(projectId: string | number, ownerUserId: string, partnerUserId: string) {
  const rows = await query(`SELECT ${PROJECT_COLS} FROM projects WHERE id = $1 AND user_id = $2`, [projectId, ownerUserId]);
  if (!rows[0]) return { error: "Project not found or not yours" };
  await query("DELETE FROM project_partners WHERE project_id = $1 AND user_id = $2", [projectId, partnerUserId]);
  await query("DELETE FROM partner_invitations WHERE project_id = $1 AND invitee_id = $2", [projectId, partnerUserId]);
  return { ok: true };
}

// Projects where the user is a partner (not the owner)
export async function getJoinedProjects(userId: string) {
  return await query(
    `SELECT p.id, p.user_id, p.title, p.description, p.stage, p.funding_needed,
            p.industry, p.visibility, p.icon_url, p.deck_url, p.video_url, p.is_active,
            p.created_at, p.updated_at,
            u.name AS owner_name, u.photo_url AS owner_photo
     FROM project_partners pp
     JOIN projects p ON p.id = pp.project_id
     JOIN users u ON u.id = p.user_id
     WHERE pp.user_id = $1 AND p.is_active = true
     ORDER BY pp.added_at DESC`,
    [userId],
  );
}

// Public read of another user's projects (for partner-invite flows)
export async function getProjectsByOwner(ownerId: string) {
  return await query(
    `SELECT id, title, description, stage, industry, icon_url, deck_url, video_url
     FROM projects WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`,
    [ownerId],
  );
}
