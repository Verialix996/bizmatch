const { query } = require('../config/db');

async function createMeeting(data) {
  const { matchId, proposerId, receiverId, title, scheduledAt, locationType, videoLink, address } = data;
  const rows = await query(
    `INSERT INTO meetings (match_id, proposer_id, receiver_id, title, scheduled_at, location_type, video_link, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [matchId, proposerId, receiverId, title || null, scheduledAt, locationType, videoLink || null, address || null]
  );
  return getMeetingById(rows[0].id);
}

async function getMeetingById(id) {
  const rows = await query(
    `SELECT m.*,
            pu.name AS proposer_name, pu.photo_url AS proposer_photo,
            ru.name AS receiver_name, ru.photo_url AS receiver_photo
     FROM meetings m
     JOIN users pu ON pu.id = m.proposer_id
     JOIN users ru ON ru.id = m.receiver_id
     WHERE m.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function getMeetingsForUser(userId) {
  return await query(
    `SELECT m.*,
            pu.name AS proposer_name, pu.photo_url AS proposer_photo,
            ru.name AS receiver_name, ru.photo_url AS receiver_photo
     FROM meetings m
     JOIN users pu ON pu.id = m.proposer_id
     JOIN users ru ON ru.id = m.receiver_id
     WHERE (m.proposer_id = $1 OR m.receiver_id = $1)
       AND m.status != 'cancelled'
     ORDER BY m.scheduled_at ASC`,
    [userId]
  );
}

async function updateMeetingStatus(id, userId, status) {
  await query('UPDATE meetings SET status = $1 WHERE id = $2', [status, id]);
  return getMeetingById(id);
}

module.exports = { createMeeting, getMeetingById, getMeetingsForUser, updateMeetingStatus };
