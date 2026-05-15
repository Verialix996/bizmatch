const { query } = require('../config/db');

async function createMeeting(data) {
  const { matchId, proposerId, receiverId, title, scheduledAt, locationType, videoLink, address } = data;
  const result = await query(
    `INSERT INTO meetings (match_id, proposer_id, receiver_id, title, scheduled_at, location_type, video_link, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [matchId, proposerId, receiverId, title || null, scheduledAt, locationType,
     videoLink || null, address || null]
  );
  return getMeetingById(result.insertId);
}

async function getMeetingById(id) {
  const rows = await query(
    `SELECT m.*,
            up.name AS proposer_name, up.photo_url AS proposer_photo,
            ur.name AS receiver_name, ur.photo_url AS receiver_photo
     FROM meetings m
     JOIN users up ON up.id = m.proposer_id
     JOIN users ur ON ur.id = m.receiver_id
     WHERE m.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getMeetingsForUser(userId) {
  return await query(
    `SELECT m.*,
            up.name AS proposer_name, up.photo_url AS proposer_photo,
            ur.name AS receiver_name, ur.photo_url AS receiver_photo
     FROM meetings m
     JOIN users up ON up.id = m.proposer_id
     JOIN users ur ON ur.id = m.receiver_id
     WHERE (m.proposer_id = ? OR m.receiver_id = ?)
       AND m.status != 'cancelled'
     ORDER BY m.scheduled_at ASC`,
    [userId, userId]
  );
}

async function updateMeetingStatus(id, userId, status) {
  await query(
    'UPDATE meetings SET status = ? WHERE id = ?',
    [status, id]
  );
  return getMeetingById(id);
}

async function saveBriefing(id, briefing) {
  await query('UPDATE meetings SET ai_briefing = ? WHERE id = ?', [briefing, id]);
}

module.exports = { createMeeting, getMeetingById, getMeetingsForUser, updateMeetingStatus, saveBriefing };
