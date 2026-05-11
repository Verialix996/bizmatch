const passport = require('passport');
const { query } = require('../db');

// Debounce map: userId → last DB write timestamp (ms)
const lastActiveWrite = new Map();
const ACTIVE_DEBOUNCE_MS = 60_000; // write at most once per minute per user

// Protect route — requires valid JWT
function authenticate(req, res, next) {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;

    // Update last_active_at debounced — fire-and-forget, never blocks the request
    const now = Date.now();
    if (!lastActiveWrite.has(user.id) || now - lastActiveWrite.get(user.id) > ACTIVE_DEBOUNCE_MS) {
      lastActiveWrite.set(user.id, now);
      query('UPDATE users SET last_active_at = NOW() WHERE id = ?', [user.id]).catch(() => {});
    }

    next();
  })(req, res, next);
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
