const { query } = require('../config/db');

function toMysqlDatetime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + iso);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function createMeeting(data) {
  const { matchId, proposerId, receiverId, title, scheduledAt, locationType, videoLink, address } = data;
  const result = await query(
    `INSERT INTO meetings (match_id, proposer_id, receiver_id, title, scheduled_at, location_type, video_link, address)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [matchId, proposerId, receiverId, title || null, toMysqlDatetime(scheduledAt), locationType,
     videoLink || null, address || null]
  );
  return getMeetingById(result.insertId);
}

async function getMeetingById(id) {
  const rows = await query(
    `SELECT m.*,
            up_u.name AS proposer_name, up_p.photo_url AS proposer_photo,
            ur_u.name AS receiver_name, ur_p.photo_url AS receiver_photo
     FROM meetings m
     JOIN users up_u ON up_u.id = m.proposer_id
     LEFT JOIN user_profiles up_p ON up_p.user_id = m.proposer_id
     JOIN users ur_u ON ur_u.id = m.receiver_id
     LEFT JOIN user_profiles ur_p ON ur_p.user_id = m.receiver_id
     WHERE m.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function getMeetingsForUser(userId) {
  return await query(
    `SELECT m.*,
            up_u.name AS proposer_name, up_p.photo_url AS proposer_photo,
            ur_u.name AS receiver_name, ur_p.photo_url AS receiver_photo
     FROM meetings m
     JOIN users up_u ON up_u.id = m.proposer_id
     LEFT JOIN user_profiles up_p ON up_p.user_id = m.proposer_id
     JOIN users ur_u ON ur_u.id = m.receiver_id
     LEFT JOIN user_profiles ur_p ON ur_p.user_id = m.receiver_id
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

module.exports = { createMeeting, getMeetingById, getMeetingsForUser, updateMeetingStatus, saveBriefing, toMysqlDatetime };
