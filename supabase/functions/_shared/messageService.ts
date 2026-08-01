import { query } from "./db.ts";
import { sendPushNotification } from "./notifications.ts";
import { background } from "./background.ts";

// Shared by both the `messages` and `meetings` functions — meeting
// propose/respond/reschedule all post a system message into the match's chat.
export async function sendMessage(
  matchId: string | number,
  senderId: string,
  body: string,
  type = "text",
  metadata: Record<string, unknown> | null = null,
) {
  const matchRows = await query<{ id: number; user1_id: string; user2_id: string }>(
    "SELECT id, user1_id, user2_id FROM matches WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)",
    [matchId, senderId],
  );
  if (!matchRows[0]) return null;

  const metaJson = metadata != null ? JSON.stringify(metadata) : null;
  const rows = await query(
    `INSERT INTO messages (match_id, sender_id, body, message_type, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, match_id, sender_id, body, message_type, metadata, created_at, read_at`,
    [matchId, senderId, body, type, metaJson],
  );

  if (type === "text") {
    const otherId = matchRows[0].user1_id === senderId ? matchRows[0].user2_id : matchRows[0].user1_id;
    background(
      query<{ name: string }>("SELECT name FROM users WHERE id = $1", [senderId]).then((senderRows) =>
        sendPushNotification(otherId, `New message from ${senderRows[0]?.name}`, body.substring(0, 80), { matchId })
      ),
    );
  }

  return rows[0];
}
