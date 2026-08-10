import { supabase } from "./supabase.ts";
import { query } from "./db.ts";
import { background } from "./background.ts";
import { json } from "./respond.ts";

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  is_verified: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  deleted_at: string | null;
  [key: string]: unknown;
}

function extractToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  // Needed for GET /founders/:id/cv, hit via direct
  // browser navigation / <img>-style requests, not fetch with headers.
  const url = new URL(req.url);
  return url.searchParams.get("token");
}

// Debounced write, without in-memory state (won't survive across isolates):
// the WHERE clause makes repeat calls within the window a no-op UPDATE, so
// it's safe to call unconditionally on every authenticated request.
function touchLastActive(userId: string): void {
  background(
    query(
      `UPDATE user_activity SET last_active_at = now()
       WHERE user_id = $1 AND (last_active_at IS NULL OR last_active_at < now() - interval '60 seconds')`,
      [userId],
    ),
  );
}

export async function authenticate(req: Request): Promise<PublicUser | null> {
  const token = extractToken(req);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const rows = await query<PublicUser>(
    "SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL",
    [data.user.id],
  );
  if (!rows[0]) return null;

  touchLastActive(rows[0].id);
  return rows[0];
}

export function requireVerified(user: PublicUser): Response | null {
  if (!user.is_verified) return json({ error: "Email not verified" }, 403);
  return null;
}

export function requireAdmin(user: PublicUser): Response | null {
  if (user.role !== "admin") return json({ error: "Admin only" }, 403);
  return null;
}
