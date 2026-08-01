const { query } = require('../config/db');

const PROJECT_COLS = 'id, user_id, title, description, stage, funding_needed, industry, visibility, icon_url, deck_url, video_url, is_active, created_at, updated_at';

async function createProject(userId, data) {
  const { title, description, stage, funding_needed, industry, visibility, icon_url, deck_url, video_url } = data;
  const rows = await query(
    `INSERT INTO projects (user_id, title, description, stage, funding_needed, industry, visibility, icon_url, deck_url, video_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${PROJECT_COLS}`,
    [userId, title, description || null, stage || null, funding_needed || null,
     industry || null, visibility || 'public', icon_url || null, deck_url || null, video_url || null]
  );
  return rows[0];
}

async function getProjectsByUser(userId) {
  return await query(
    `SELECT ${PROJECT_COLS} FROM projects WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`,
    [userId]
  );
}

async function getProjectById(id) {
  const rows = await query(`SELECT ${PROJECT_COLS} FROM projects WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function updateProject(id, userId, data) {
  const { title, description, stage, funding_needed, industry, visibility, deck_url, video_url } = data;
  const rows = await query(
    `UPDATE projects
     SET title = $1, description = $2, stage = $3, funding_needed = $4,
         industry = $5, visibility = $6, deck_url = $7, video_url = $8, updated_at = now()
     WHERE id = $9 AND user_id = $10
     RETURNING ${PROJECT_COLS}`,
    [title, description || null, stage || null, funding_needed || null,
     industry || null, visibility || 'public', deck_url || null, video_url || null, id, userId]
  );
  return rows[0] || null;
}

async function deleteProject(id, userId) {
  await query('UPDATE projects SET is_active = false WHERE id = $1 AND user_id = $2', [id, userId]);
}

module.exports = { createProject, getProjectsByUser, getProjectById, updateProject, deleteProject };
