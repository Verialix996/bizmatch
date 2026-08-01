const { query } = require('../config/db');
const { sendPushNotification } = require('../services/notification.service');

async function sendMessage(matchId, senderId, body, type = 'text', metadata = null) {
  const matchRows = await query(
    'SELECT id, user1_id, user2_id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, senderId]
  );
  if (!matchRows[0]) return null;

  const metaJson = metadata != null ? JSON.stringify(metadata) : null;
  const rows = await query(
    `INSERT INTO messages (match_id, sender_id, body, message_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, match_id, sender_id, body, message_type, metadata, created_at, read_at`,
    [matchId, senderId, body, type, metaJson]
  );

  if (type === 'text') {
    const otherId = matchRows[0].user1_id === senderId ? matchRows[0].user2_id : matchRows[0].user1_id;
    query('SELECT name FROM users WHERE id = $1', [senderId]).then(senderRows => {
      sendPushNotification(otherId, `New message from ${senderRows[0]?.name}`, body.substring(0, 80), { matchId });
    }).catch(() => {});
  }

  return rows[0];
}

async function getMessages(matchId, userId, limit = 50, offset = 0, after = null) {
  const matchRows = await query(
    'SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [matchId, userId]
  );
  if (!matchRows[0]) return null;

  if (after != null) {
    return await query(
      `SELECT m.id, m.match_id, m.sender_id, m.body, m.message_type, m.metadata, m.created_at, m.read_at,
              u.name AS sender_name, u.photo_url AS sender_photo
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.match_id = $1 AND m.id > $2
       ORDER BY m.created_at ASC`,
      [matchId, after]
    );
  }

  return await query(
    `SELECT m.id, m.match_id, m.sender_id, m.body, m.message_type, m.metadata, m.created_at, m.read_at,
            u.name AS sender_name, u.photo_url AS sender_photo
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.match_id = $1
     ORDER BY m.created_at ASC
     LIMIT $2 OFFSET $3`,
    [matchId, limit, offset]
  );
}

async function getConversations(userId) {
  return await query(
    `SELECT
       m.id AS "matchId",
       m.created_at AS "matchedAt",
       u.id AS "userId",
       u.name,
       u.photo_url AS "photoUrl",
       u.role AS "roleType",
       u.bio,
       ip.investment_domain AS "investmentDomain",
       ent_proj.stage AS "ventureStage",
       lm.body AS "lastMessage",
       lm.created_at AS "lastMessageAt",
       lm.read_at AS "lastMessageReadAt",
       lm.sender_id AS "lastMessageSenderId"
     FROM matches m
     JOIN users u ON u.id = (CASE WHEN m.user1_id = $1 THEN m.user2_id ELSE m.user1_id END)
     LEFT JOIN investor_profiles ip ON ip.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT p.stage FROM projects p
       WHERE p.user_id = u.id AND p.is_active = true
       ORDER BY p.id DESC LIMIT 1
     ) ent_proj ON true
     LEFT JOIN LATERAL (
       SELECT * FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1
     ) lm ON true
     WHERE (m.user1_id = $1 OR m.user2_id = $1)
       AND u.deleted_at IS NULL
     ORDER BY COALESCE(lm.created_at, m.created_at) DESC`,
    [userId]
  );
}

async function markMessagesRead(matchId, userId) {
  // Stamp read_at on all messages in this match sent by the OTHER user that haven't been read yet
  await query(
    `UPDATE messages SET read_at = now()
     WHERE match_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [matchId, userId]
  );
}

module.exports = { sendMessage, getMessages, getConversations, markMessagesRead };
