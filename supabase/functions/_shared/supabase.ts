import { createClient } from "npm:@supabase/supabase-js@2";

// Service-role client — used only for verifying end-user JWTs
// (supabase.auth.getUser(token)) and admin-only auth operations
// (auth.admin.deleteUser). All app data queries go through db.ts, not this client.
// SUPABASE_SERVICE_ROLE_KEY is platform-injected on legacy (JWT) key projects;
// SUPABASE_SECRET_KEY is the equivalent for projects on the new key format
// (sb_secret_...) — this project uses the latter, set as an explicit secret.
export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY"))!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
