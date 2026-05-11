const { query } = require('../config/db');
const { sendPushNotification } = require('../services/notification.service');

async function sendMessage(matchId, senderId, body, type = 'text', metadata = null) {
  const matchRows = await query(
    'SELECT id, user1_id, user2_id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [matchId, senderId, senderId]
  );
  if (!matchRows[0]) return null;

  const metaJson = metadata != null ? JSON.stringify(metadata) : null;
  const result = await query(
    'INSERT INTO messages (match_id, sender_id, body, message_type, metadata) VALUES (?, ?, ?, ?, ?)',
    [matchId, senderId, body, type, metaJson]
  );

  const rows = await query(
    'SELECT id, match_id, sender_id, body, message_type, metadata, created_at, read_at FROM messages WHERE id = ?',
    [result.insertId]
  );

  if (type === 'text') {
    const otherId = matchRows[0].user1_id === senderId ? matchRows[0].user2_id : matchRows[0].user1_id;
    query('SELECT name FROM users WHERE id = ?', [senderId]).then(senderRows => {
      sendPushNotification(otherId, `New message from ${senderRows[0]?.name}`, body.substring(0, 80), { matchId });
    }).catch(() => {});
  }

  return rows[0];
}

async function getMessages(matchId, userId, limit = 50, offset = 0, after = null) {
  const matchRows = await query(
    'SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)',
    [matchId, userId, userId]
  );
  if (!matchRows[0]) return null;

  if (after != null) {
    return await query(
      `SELECT m.id, m.match_id, m.sender_id, m.body, m.message_type, m.metadata, m.created_at, m.read_at,
              u.name AS sender_name, u.photo_url AS sender_photo
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.match_id = ? AND m.id > ?
       ORDER BY m.created_at ASC`,
      [matchId, after]
    );
  }

  return await query(
    `SELECT m.id, m.match_id, m.sender_id, m.body, m.message_type, m.metadata, m.created_at, m.read_at,
            u.name AS sender_name, u.photo_url AS sender_photo
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.match_id = ?
     ORDER BY m.created_at ASC
     LIMIT ${limit} OFFSET ${offset}`,
    [matchId]
  );
}

async function getConversations(userId) {
  return await query(
    `SELECT
       m.id AS matchId,
       m.created_at AS matchedAt,
       m.ai_summary AS aiSummary,
       u.id AS userId,
       u.name,
       u.photo_url AS photoUrl,
       u.last_active_at AS lastActiveAt,
       p.role_type AS roleType,
       p.bio,
       p.venture_stage AS ventureStage,
       p.investment_domain AS investmentDomain,
       (SELECT body FROM messages
        WHERE match_id = m.id
        ORDER BY created_at DESC LIMIT 1) AS lastMessage,
       (SELECT created_at FROM messages
        WHERE match_id = m.id
        ORDER BY created_at DESC LIMIT 1) AS lastMessageAt,
       (SELECT sender_id FROM messages
        WHERE match_id = m.id
        ORDER BY created_at DESC LIMIT 1) AS lastMessageSenderId
     FROM matches m
     JOIN users u ON u.id = CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE (m.user1_id = ? OR m.user2_id = ?)
       AND u.deleted_at IS NULL
     ORDER BY COALESCE(lastMessageAt, m.created_at) DESC`,
    [userId, userId, userId]
  );
}

async function markMessagesRead(matchId, userId) {
  // Stamp read_at on all messages in this match sent by the OTHER user that haven't been read yet
  await query(
    `UPDATE messages SET read_at = NOW()
     WHERE match_id = ? AND sender_id != ? AND read_at IS NULL`,
    [matchId, userId]
  );
}

module.exports = { sendMessage, getMessages, getConversations, markMessagesRead };
