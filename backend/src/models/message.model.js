const { getDb } = require('../config/db');

/**
 * Send a message within a match conversation.
 * Verifies the sender is part of the match before inserting.
 */
function sendMessage(matchId, senderId, body) {
  const db = getDb();

  const match = db
    .prepare('SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)')
    .get(matchId, senderId, senderId);

  if (!match) return null;

  const result = db
    .prepare('INSERT INTO messages (match_id, sender_id, body) VALUES (?, ?, ?)')
    .run(matchId, senderId, body);

  return db
    .prepare('SELECT * FROM messages WHERE id = ?')
    .get(result.lastInsertRowid);
}

/**
 * Get paginated messages for a match (newest first).
 */
function getMessages(matchId, userId, limit = 50, offset = 0) {
  const db = getDb();

  // Auth check
  const match = db
    .prepare('SELECT id FROM matches WHERE id = ? AND (user1_id = ? OR user2_id = ?)')
    .get(matchId, userId, userId);

  if (!match) return null;

  return db
    .prepare(
      `SELECT m.id, m.match_id, m.sender_id, m.body, m.created_at,
              u.name AS sender_name, u.photo_url AS sender_photo
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.match_id = ?
       ORDER BY m.created_at ASC
       LIMIT ? OFFSET ?`
    )
    .all(matchId, limit, offset);
}

/**
 * Get all conversations for a user — one row per match,
 * including the other person's info and the latest message.
 */
function getConversations(userId) {
  const db = getDb();

  return db
    .prepare(
      `SELECT
         m.id AS matchId,
         m.created_at AS matchedAt,
         u.id AS userId,
         u.name,
         u.photo_url AS photoUrl,
         p.role_type AS roleType,
         p.bio,
         p.venture_stage AS ventureStage,
         p.investment_domain AS investmentDomain,
         (SELECT body FROM messages
          WHERE match_id = m.id
          ORDER BY created_at DESC LIMIT 1) AS lastMessage,
         (SELECT created_at FROM messages
          WHERE match_id = m.id
          ORDER BY created_at DESC LIMIT 1) AS lastMessageAt
       FROM matches m
       JOIN users u ON u.id = CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE (m.user1_id = ? OR m.user2_id = ?)
         AND u.deleted_at IS NULL
       ORDER BY COALESCE(lastMessageAt, m.created_at) DESC`
    )
    .all(userId, userId, userId);
}

module.exports = { sendMessage, getMessages, getConversations };
