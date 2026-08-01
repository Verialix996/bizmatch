const supabase = require('../config/supabase');
const { query } = require('../config/db');

// Debounce map: userId → last DB write timestamp (ms)
const lastActiveWrite = new Map();
const ACTIVE_DEBOUNCE_MS = 60_000; // write at most once per minute per user

// Protect route — requires a valid Supabase Auth session token. Verifies the
// bearer token against Supabase, then looks up the matching public.users row
// (same uuid as auth.users.id) and attaches it as req.user — same shape every
// controller already expects.
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' });

    const rows = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [data.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Unauthorized' });
    req.user = rows[0];

    // Update last_active_at debounced — fire-and-forget, never blocks the request
    const now = Date.now();
    if (!lastActiveWrite.has(req.user.id) || now - lastActiveWrite.get(req.user.id) > ACTIVE_DEBOUNCE_MS) {
      lastActiveWrite.set(req.user.id, now);
      query('UPDATE user_activity SET last_active_at = now() WHERE user_id = $1', [req.user.id]).catch(() => {});
    }

    next();
  } catch (err) {
    next(err);
  }
}

// Require email verified
function requireVerified(req, res, next) {
  if (!req.user.is_verified) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  next();
}

// Require admin role
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

module.exports = { authenticate, requireVerified, requireAdmin };
