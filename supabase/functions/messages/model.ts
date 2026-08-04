import { query } from "../_shared/db.ts";

export async function getMessages(
  matchId: string,
  userId: string,
  limit = 50,
  offset = 0,
  after: number | null = null,
) {
  const matchRows = await query(
    "SELECT id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
    [matchId, userId],
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
      [matchId, after],
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
    [matchId, limit, offset],
  );
}

export async function getConversations(userId: string) {
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
       SELECT t.stage FROM team_members tm JOIN teams t ON t.id = tm.team_id AND t.is_active = true
       WHERE tm.user_id = u.id AND tm.status = 'accepted'
       ORDER BY t.created_at DESC LIMIT 1
     ) ent_proj ON true
     LEFT JOIN LATERAL (
       SELECT * FROM messages WHERE match_id = m.id ORDER BY id DESC LIMIT 1
     ) lm ON true
     WHERE (m.user1_id = $1 OR m.user2_id = $1)
       AND u.deleted_at IS NULL
     ORDER BY COALESCE(lm.created_at, m.created_at) DESC`,
    [userId],
  );
}

export async function markMessagesRead(matchId: string, userId: string) {
  await query(
    `UPDATE messages SET read_at = now()
     WHERE match_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [matchId, userId],
  );
}
