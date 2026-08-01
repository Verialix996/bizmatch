const { moderateText } = require('../services/moderation.service');

// POST /api/auth/precheck-name — called by the client immediately before
// supabase.auth.signUp, since Supabase has no pre-insert hook for custom
// validation. Registration, login, email verification, password reset, and
// Google OAuth are all handled directly by the Supabase Auth client SDK now
// (see frontend/src/services/auth.service.js) — this backend no longer
// issues its own tokens or owns any credential state.
async function precheckName(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const mod = await moderateText(name.trim());
    if (!mod.ok) return res.status(400).json({ error: `Name flagged by moderation: ${mod.reason}` });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { precheckName };
