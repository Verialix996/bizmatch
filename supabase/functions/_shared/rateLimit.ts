import { query } from "./db.ts";

// Fixed-window counter backed by the rate_limits table (see
// supabase/migrations/20260801170000_rate_limits.sql) — no in-memory store,
// since Edge Functions are stateless/multi-instance.
export async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const rows = await query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, $2, 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowStart.toISOString()],
  );
  return rows[0].count <= max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
