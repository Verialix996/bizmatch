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
              u.name AS sender_name, up.photo_url AS sender_photo
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       LEFT JOIN user_profiles up ON up.user_id = m.sender_id
       WHERE m.match_id = ? AND m.id > ?
       ORDER BY m.created_at ASC`,
      [matchId, after]
    );
  }

  return await query(
    `SELECT m.id, m.match_id, m.sender_id, m.body, m.message_type, m.metadata, m.created_at, m.read_at,
            u.name AS sender_name, up.photo_url AS sender_photo
     FROM messages m
     JOIN users u ON u.id = m.sender_id
     LEFT JOIN user_profiles up ON up.user_id = m.sender_id
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
       up.photo_url AS photoUrl,
       up.role_type AS roleType,
       up.bio,
       ip.investment_domain AS investmentDomain,
       ent_proj.stage AS ventureStage,
       lm.body AS lastMessage,
       lm.created_at AS lastMessageAt,
       lm.sender_id AS lastMessageSenderId,
       proj.title AS projectName,
       proj.id AS projectId,
       pm.investor_id AS projectInvestorId
     FROM matches m
     JOIN users u ON u.id = IF(m.user1_id = ?, m.user2_id, m.user1_id)
     LEFT JOIN user_profiles up ON up.user_id = u.id
     LEFT JOIN investor_profiles ip ON ip.user_id = u.id
     LEFT JOIN (
       SELECT pr.user_id, pr.stage
       FROM projects pr
       INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
     ) ent_proj ON ent_proj.user_id = u.id
     LEFT JOIN (
       SELECT match_id, MAX(id) AS max_id FROM messages GROUP BY match_id
     ) latest ON latest.match_id = m.id
     LEFT JOIN messages lm ON lm.id = latest.max_id
     LEFT JOIN project_matches pm ON (
       LEAST(pm.investor_id, pm.user_id) = m.user1_id
       AND GREATEST(pm.investor_id, pm.user_id) = m.user2_id
     )
     LEFT JOIN projects proj ON proj.id = pm.project_id
     WHERE (m.user1_id = ? OR m.user2_id = ?)
       AND u.deleted_at IS NULL
     ORDER BY COALESCE(lm.created_at, m.created_at) DESC`,
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
