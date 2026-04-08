const { getDb } = require('../config/db');

function safeParseArray(value) {
  if (!value) return [];
  try { const p = JSON.parse(value); return Array.isArray(p) ? p : []; } catch { return []; }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

function createProject(userId, data) {
  const db = getDb();
  const { title, description, stage, funding_needed, industry, deck_url, video_url } = data;
  const result = db.prepare(
    `INSERT INTO projects (user_id, title, description, stage, funding_needed, industry, deck_url, video_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, title, description || null, stage || null, funding_needed || null,
        industry || null, deck_url || null, video_url || null);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
}

function getProjectsByUser(userId) {
  return getDb()
    .prepare('SELECT * FROM projects WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC')
    .all(userId);
}

function getProjectById(id) {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) || null;
}

function updateProject(id, userId, data) {
  const db = getDb();
  const { title, description, stage, funding_needed, industry, deck_url, video_url } = data;
  db.prepare(
    `UPDATE projects
     SET title = ?, description = ?, stage = ?, funding_needed = ?,
         industry = ?, deck_url = ?, video_url = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`
  ).run(title, description || null, stage || null, funding_needed || null,
        industry || null, deck_url || null, video_url || null, id, userId);
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
}

function deleteProject(id, userId) {
  getDb().prepare('UPDATE projects SET is_active = 0 WHERE id = ? AND user_id = ?').run(id, userId);
}

// ── Feed for investors ────────────────────────────────────────────────────────

/**
 * Returns projects the investor has NOT yet swiped on,
 * scored by how well they match investor preferences.
 */
function getProjectFeed(investorId, limit = 20) {
  const db = getDb();

  const swiped = db
    .prepare('SELECT project_id FROM project_swipes WHERE investor_id = ?')
    .all(investorId)
    .map(r => r.project_id);

  // Fetch investor profile for scoring
  const investorProfile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(investorId);

  // Build the exclusion clause for swiped project IDs only when there are some
  // (NOT IN (NULL) evaluates to false for every row in SQL — never use NULL as the list)
  const swipedClause = swiped.length > 0
    ? `AND p.id NOT IN (${swiped.map(() => '?').join(',')})`
    : '';

  const projects = db
    .prepare(
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
         ${swipedClause}`
    )
    .all(investorId, ...swiped);

  const scored = projects.map(p => {
    let score = 0;
    if (investorProfile) {
      // Stage match
      if (investorProfile.preferred_stage && p.stage === investorProfile.preferred_stage) score += 40;
      // Budget covers funding need
      if (investorProfile.max_investment && p.funding_needed &&
          investorProfile.max_investment >= p.funding_needed) score += 30;
      // Domain matches industry
      if (investorProfile.investment_domain && p.industry) {
        if (p.industry.toLowerCase().includes(investorProfile.investment_domain.toLowerCase()) ||
            investorProfile.investment_domain.toLowerCase().includes(p.industry.toLowerCase())) {
          score += 30;
        }
      }
      // Has a deck
      if (p.deck_url) score += 10;
      // Has a video
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

function swipeProject(investorId, projectId, direction) {
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND is_active = 1').get(projectId);
  if (!project) return { error: 'Project not found' };
  if (project.user_id === investorId) return { error: 'Cannot swipe own project' };

  db.prepare(
    `INSERT INTO project_swipes (investor_id, project_id, direction) VALUES (?, ?, ?)
     ON CONFLICT(investor_id, project_id) DO UPDATE SET direction = excluded.direction`
  ).run(investorId, projectId, direction);

  if (direction !== 'like') return { matched: false };

  // Auto-match when investor likes a project
  db.prepare(
    `INSERT OR IGNORE INTO project_matches (investor_id, project_id, user_id) VALUES (?, ?, ?)`
  ).run(investorId, projectId, project.user_id);

  // Create a user-to-user match so the conversation appears in the Matches/chat screen
  const [u1, u2] = investorId < project.user_id
    ? [investorId, project.user_id]
    : [project.user_id, investorId];
  db.prepare('INSERT OR IGNORE INTO matches (user1_id, user2_id) VALUES (?, ?)').run(u1, u2);

  return { matched: true, projectTitle: project.title, entrepreneurId: project.user_id };
}

// ── Matches ───────────────────────────────────────────────────────────────────

function getProjectMatches(userId, role) {
  const db = getDb();
  if (role === 'investor') {
    return db.prepare(
      `SELECT pm.*, p.title, p.description, p.stage, p.funding_needed, p.industry,
              p.deck_url, p.video_url,
              u.name AS owner_name, u.photo_url AS owner_photo
       FROM project_matches pm
       JOIN projects p ON p.id = pm.project_id
       JOIN users u ON u.id = pm.user_id
       WHERE pm.investor_id = ?
       ORDER BY pm.created_at DESC`
    ).all(userId);
  }
  // Entrepreneur: see which investors liked their projects
  return db.prepare(
    `SELECT pm.*, p.title, p.description,
            u.name AS investor_name, u.photo_url AS investor_photo,
            pr.bio AS investor_bio, pr.investment_domain
     FROM project_matches pm
     JOIN projects p ON p.id = pm.project_id
     JOIN users u ON u.id = pm.investor_id
     LEFT JOIN profiles pr ON pr.user_id = pm.investor_id
     WHERE p.user_id = ?
     ORDER BY pm.created_at DESC`
  ).all(userId);
}

// ── Partners ──────────────────────────────────────────────────────────────────

function getProjectPartners(projectId) {
  return getDb()
    .prepare(
      `SELECT pp.user_id, u.name, u.photo_url, pr.bio, pr.role_type, pr.skills
       FROM project_partners pp
       JOIN users u ON u.id = pp.user_id
       LEFT JOIN profiles pr ON pr.user_id = pp.user_id
       WHERE pp.project_id = ?
       ORDER BY pp.added_at ASC`
    )
    .all(projectId)
    .map(r => ({
      userId: r.user_id,
      name: r.name,
      photoUrl: r.photo_url,
      bio: r.bio,
      roleType: r.role_type,
      skills: safeParseArray(r.skills),
    }));
}

function addProjectPartner(projectId, ownerUserId, partnerUserId) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, ownerUserId);
  if (!project) return { error: 'Project not found or not yours' };
  if (partnerUserId === ownerUserId) return { error: 'Cannot add yourself as partner' };

  db.prepare(
    `INSERT OR IGNORE INTO project_partners (project_id, user_id) VALUES (?, ?)`
  ).run(projectId, partnerUserId);

  return { ok: true };
}

function removeProjectPartner(projectId, ownerUserId, partnerUserId) {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, ownerUserId);
  if (!project) return { error: 'Project not found or not yours' };
  db.prepare('DELETE FROM project_partners WHERE project_id = ? AND user_id = ?').run(projectId, partnerUserId);
  return { ok: true };
}

// ── Visibility ────────────────────────────────────────────────────────────────

function setProjectVisibility(id, userId, visibility) {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(id, userId);
  if (!project) return { error: 'Project not found or not yours' };
  db.prepare("UPDATE projects SET visibility = ?, updated_at = datetime('now') WHERE id = ?")
    .run(visibility, id);
  return { ok: true };
}

// ── NDA ───────────────────────────────────────────────────────────────────────

function getNdaStatus(projectId, userId) {
  const row = getDb()
    .prepare('SELECT id FROM project_ndas WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);
  return !!row;
}

function signNda(projectId, userId) {
  getDb()
    .prepare('INSERT OR IGNORE INTO project_ndas (project_id, user_id) VALUES (?, ?)')
    .run(projectId, userId);
  return { ok: true };
}

// ── Partner invitations ───────────────────────────────────────────────────────

function createPartnerInvitation(projectId, matchId, inviterId, inviteeId) {
  const db = getDb();
  const project = db
    .prepare('SELECT id, title FROM projects WHERE id = ? AND user_id = ? AND is_active = 1')
    .get(projectId, inviterId);
  if (!project) return { error: 'Project not found or not yours' };

  try {
    const result = db
      .prepare(
        'INSERT INTO partner_invitations (project_id, match_id, inviter_id, invitee_id) VALUES (?, ?, ?, ?)'
      )
      .run(projectId, matchId, inviterId, inviteeId);
    return { ok: true, invitationId: result.lastInsertRowid, projectTitle: project.title };
  } catch {
    return { error: 'An invitation for this project has already been sent to this user' };
  }
}

function getPartnerInvitation(id) {
  return getDb().prepare('SELECT * FROM partner_invitations WHERE id = ?').get(id) || null;
}

function respondPartnerInvitation(invitationId, userId, status) {
  const db = getDb();
  const inv = db.prepare('SELECT * FROM partner_invitations WHERE id = ?').get(invitationId);
  if (!inv) return { error: 'Invitation not found' };
  if (inv.invitee_id !== userId) return { error: 'Not your invitation' };
  if (inv.status !== 'pending') return { error: 'Invitation already responded to' };

  db.prepare('UPDATE partner_invitations SET status = ? WHERE id = ?').run(status, invitationId);

  if (status === 'accepted') {
    db.prepare('INSERT OR IGNORE INTO project_partners (project_id, user_id) VALUES (?, ?)')
      .run(inv.project_id, userId);
  }

  return { ok: true };
}

module.exports = {
  createProject, getProjectsByUser, getProjectById, updateProject, deleteProject,
  getProjectFeed, swipeProject, getProjectMatches,
  getProjectPartners, addProjectPartner, removeProjectPartner,
  setProjectVisibility,
  getNdaStatus, signNda,
  createPartnerInvitation, getPartnerInvitation, respondPartnerInvitation,
};
