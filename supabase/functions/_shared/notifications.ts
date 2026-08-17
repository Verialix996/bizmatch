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

// Fans a notification out to every admin/evaluator account — the events that
// use this (new evidence, a flagged deal breaker) are things the cohort's
// evaluator(s) should see regardless of which one happens to be looking.
export async function notifyAdmins(
  type: string,
  refId: string | number | null,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const admins = await query<{ id: string }>("SELECT id FROM users WHERE role = 'admin'");
  await Promise.all(admins.map((a) => emitNotification(a.id, type, refId, payload)));
}
