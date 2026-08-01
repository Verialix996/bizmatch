import { query } from "./db.ts";

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const rows = await query<{ push_token: string | null }>(
      "SELECT push_token FROM user_activity WHERE user_id = $1",
      [userId],
    );
    const token = rows[0]?.push_token;
    if (!token || !token.startsWith("ExponentPushToken")) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: token, title, body, data, sound: "default" }),
    });
  } catch {
    // non-critical — never let push failure affect the main request
  }
}

export async function emitNotification(
  userId: string,
  type: string,
  refId: string | number | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      "INSERT INTO notifications (user_id, type, ref_id, payload) VALUES ($1, $2, $3, $4)",
      [userId, type, refId ?? null, JSON.stringify(payload)],
    );
  } catch (err) {
    console.error("[emitNotification] failed:", type, (err as Error).message);
  }
}
