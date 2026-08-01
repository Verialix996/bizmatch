const { createClient } = require('@supabase/supabase-js');

// Service-role client — used only for verifying end-user JWTs
// (supabase.auth.getUser(token)) and for admin-only auth operations
// (e.g. scripts/seed.js creating demo accounts). All actual app data queries
// go through the pg pool in config/db.js, not this client.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = supabase;
