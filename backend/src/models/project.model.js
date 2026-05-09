const { query } = require('../config/db');

function safeParseArray(value) {
  if (!value) return [];
  try { const p = JSON.parse(value); return Array.isArray(p) ? p : []; } catch { return []; }
}

const STAGE_LADDER = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c'];

function stageScore(stageA, stageB) {
  const i = STAGE_LADDER.indexOf((stageA || '').toLowerCase());
  const j = STAGE_LADDER.indexOf((stageB || '').toLowerCase());
  if (i === -1 || j === -1) return 0;
  const diff = Math.abs(i - j);
  if (diff === 0) return 40;
  if (diff === 1) return 20;
  if (diff === 2) return 5;
  return 0;
}

function budgetScore(maxInvestment, fundingNeeded) {
  if (maxInvestment == null || fundingNeeded == null || fundingNeeded === 0) return 0;
  const ratio = maxInvestment / fundingNeeded;
  if (ratio >= 1)    return 30;
  if (ratio >= 0.75) return 20;
  if (ratio >= 0.5)  return 10;
  return 0;
}

function jaccardScore(textA, textB, maxPts) {
  const tokenize = t => new Set((t || '').toLowerCase().split(/[\s,;|]+/).filter(Boolean));
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter(x => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return Math.round((intersection / union) * maxPts);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function createProject(userId, data) {
  const { title, description, stage, funding_needed, industry, deck_url, video_url } = data;
  const result = await query(
    `INSERT INTO projects (user_id, title, description, stage, funding_needed, industry, deck_url, video_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, title, description || null, stage || null, funding_needed || null,
     industry || null, deck_url || null, video_url || null]
  );
  const rows = await query('SELECT * FROM projects WHERE id = ?', [result.insertId]);
  return rows[0];
}

async function getProjectsByUser(userId) {
  return await query(
    'SELECT * FROM projects WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
    [userId]
  );
}

async function getProjectById(id) {
  const rows = await query('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] || null;
}

async function updateProject(id, userId, data) {
  const { title, description, stage, funding_needed, industry, deck_url, video_url } = data;
  await query(
    `UPDATE projects
     SET title = ?, description = ?, stage = ?, funding_needed = ?,
         industry = ?, deck_url = ?, video_url = ?, updated_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [title, description || null, stage || null, funding_needed || null,
     industry || null, deck_url || null, video_url || null, id, userId]
  );
  const rows = await query('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] || null;
}

async function deleteProject(id, userId) {
  await query('UPDATE projects SET is_active = 0 WHERE id = ? AND user_id = ?', [id, userId]);
}

// ── Feed for investors ────────────────────────────────────────────────────────

async function getProjectFeed(investorId, limit = 20) {
  const swipedRows = await query(
    'SELECT project_id FROM project_swipes WHERE investor_id = ?',
    [investorId]
  );
  const swiped = swipedRows.map(r => r.project_id);

  const investorProfileRows = await query('SELECT * FROM profiles WHERE user_id = ?', [investorId]);
  const investorProfile = investorProfileRows[0];

  const swipedClause = swiped.length > 0
    ? `AND p.id NOT IN (${swiped.map(() => '?').join(',')})`
    : '';

  const projects = await query(
    `SELECT p.*, u.name AS owner_name, u.photo_url AS owner_photo,
            pr.bio AS owner_bio, pr.skills AS owner_skills
     FROM projects p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN profiles pr ON pr.user_id = p.user_id
     WHERE p.is_active = 1
       AND p.visibility = 'public'
       AND u.role = 'entrepreneur'
       AND u.deleted_at IS NULL
       AND p.user_id != ?
       ${swipedClause}`,
    [investorId, ...swiped]
  );

  const scored = projects.map(p => {
    let score = 0;
    if (investorProfile) {
      score += stageScore(investorProfile.preferred_stage, p.stage);
      score += budgetScore(investorProfile.max_investment, p.funding_needed);
      const entText = [
        p.industry || '',
        ...(safeParseArray(p.owner_skills)),
        p.owner_bio || '',
      ].join(' ');
      score += jaccardScore(investorProfile.investment_domain || '', entText, 30);
      if (p.deck_url)  score += 10;
      if (p.video_url) score += 10;
    }
    return {
      projectId: p.id,
      userId: p.user_id,
      ownerName: p.owner_name,
      ownerPhoto: p.owner_photo,
      ownerBio: p.owner_bio,
      ownerSkills: safeParseArray(p.owner_skills),
      title: p.title,
      description: p.description,
      stage: p.stage,
      fundingNeeded: p.funding_needed,
      industry: p.industry,
      deckUrl: p.deck_url,
      videoUrl: p.video_url,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Swipe on a project ────────────────────────────────────────────────────────

async function swipeProject(investorId, projectId, direction) {
  const projectRows = await query(
    'SELECT * FROM projects WHERE id = ? AND is_active = 1',
    [projectId]
  );
  const project = projectRows[0];
  if (!project) return { error: 'Project not found' };
  if (project.user_id === investorId) return { error: 'Cannot swipe own project' };

  await query(
    `INSERT INTO project_swipes (investor_id, project_id, direction) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE direction = VALUES(direction)`,
    [investorId, projectId, direction]
  );

  if (direction !== 'like') return { matched: false };

  await query(
    'INSERT IGNORE INTO project_matches (investor_id, project_id, user_id) VALUES (?, ?, ?)',
    [investorId, projectId, project.user_id]
  );

  const [u1, u2] = investorId < project.user_id
    ? [investorId, project.user_id]
    : [project.user_id, investorId];
  await query('INSERT IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)', [u1, u2]);

  const matchRows = await query(
    'SELECT id FROM matches WHERE user1_id = ? AND user2_id = ?',
    [u1, u2]
  );

  return { matched: true, matchId: matchRows[0]?.id ?? null, projectTitle: project.title, entrepreneurId: project.user_id };
}

// ── Matches ───────────────────────────────────────────────────────────────────

async function getProjectMatches(userId, role) {
  if (role === 'investor') {
    return await query(
      `SELECT pm.*, p.title, p.description, p.stage, p.funding_needed, p.industry,
              p.deck_url, p.video_url,
              u.name AS owner_name, u.photo_url AS owner_photo
       FROM project_matches pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE pm.investor_id = ?
       ORDER BY pm.created_at DESC`,
      [userId]
    );
  }
  return await query(
    `SELECT pm.*, p.title, p.description,
            u.name AS investor_name, u.photo_url AS investor_photo,
            pr.bio AS investor_bio, pr.investment_domain
     FROM project_matches pm
     JOIN projects p ON p.id = pm.project_id
     JOIN users u ON u.id = pm.investor_id
     LEFT JOIN profiles pr ON pr.user_id = pm.investor_id
     WHERE p.user_id = ?
     ORDER BY pm.created_at DESC`,
    [userId]
  );
}

// ── Partners ──────────────────────────────────────────────────────────────────

async function getProjectPartners(projectId) {
  const rows = await query(
    `SELECT pp.user_id, u.name, u.photo_url, pr.bio, pr.role_type, pr.skills
     FROM project_partners pp
     JOIN users u ON u.id = pp.user_id
     LEFT JOIN profiles pr ON pr.user_id = pp.user_id
     WHERE pp.project_id = ?
     ORDER BY pp.added_at ASC`,
    [projectId]
  );
  return rows.map(r => ({
    userId: r.user_id,
    name: r.name,
    photoUrl: r.photo_url,
    bio: r.bio,
    roleType: r.role_type,
    skills: safeParseArray(r.skills),
  }));
}

async function addProjectPartner(projectId, ownerUserId, partnerUserId) {
  const rows = await query(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, ownerUserId]
  );
  if (!rows[0]) return { error: 'Project not found or not yours' };
  if (partnerUserId === ownerUserId) return { error: 'Cannot add yourself as partner' };
  await query(
    'INSERT IGNORE INTO project_partners (project_id, user_id) VALUES (?, ?)',
    [projectId, partnerUserId]
  );
  return { ok: true };
}

async function removeProjectPartner(projectId, ownerUserId, partnerUserId) {
  const rows = await query(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, ownerUserId]
  );
  if (!rows[0]) return { error: 'Project not found or not yours' };
  await query(
    'DELETE FROM project_partners WHERE project_id = ? AND user_id = ?',
    [projectId, partnerUserId]
  );
  return { ok: true };
}

// Projects where the user is a partner (not the owner)
async function getJoinedProjects(userId) {
  return await query(
    `SELECT p.*, u.name AS owner_name, u.photo_url AS owner_photo
     FROM project_partners pp
     JOIN projects p ON p.id = pp.project_id
     JOIN users u ON u.id = p.user_id
     WHERE pp.user_id = ? AND p.is_active = 1
     ORDER BY pp.added_at DESC`,
    [userId]
  );
}

// Public read of another user's projects (for NDA request / partner flows)
async function getProjectsByOwner(ownerId) {
  return await query(
    `SELECT id, title, description, stage, industry, deck_url, video_url
     FROM projects WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC`,
    [ownerId]
  );
}

module.exports = {
  createProject, getProjectsByUser, getProjectById, updateProject, deleteProject,
  getProjectFeed, swipeProject, getProjectMatches,
  getProjectPartners, addProjectPartner, removeProjectPartner,
  getJoinedProjects, getProjectsByOwner,
};
