const router = require('express').Router();
const { authLimiter } = require('../middleware/rateLimiter');
const ctrl = require('../controllers/auth.controller');

// Registration, login, email verification, password reset, and Google OAuth
// are all handled client-side via the Supabase Auth SDK now — the only thing
// left here is a pre-signup moderation check the client can't do itself.
router.post('/precheck-name', authLimiter, ctrl.precheckName);

module.exports = router;
