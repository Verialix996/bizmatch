const router = require('express').Router();
const passport = require('passport');
const { body } = require('express-validator');
const { authLimiter } = require('../middleware/rateLimiter');
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/auth.controller');

const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty().trim(),
  body('role').isIn(['entrepreneur', 'investor']),
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// Email/password
router.post('/register', authLimiter, validateRegister, ctrl.register);
router.post('/login',    authLimiter, validateLogin,    ctrl.login);

// Email verification (OTP)
router.post('/verify-email', ctrl.verifyEmail);
router.post('/resend-otp',   ctrl.resendOtp);

// Password recovery
router.post('/forgot-password', authLimiter, ctrl.forgotPassword);
router.post('/reset-password',  authLimiter, ctrl.resetPassword);

// 2FA (requires login first)
router.post('/2fa/setup',  authenticate, ctrl.setup2FA);
router.post('/2fa/verify', authenticate, ctrl.verify2FA);

// Google OAuth (web/browser flow)
// ?oid=<id> is passed by the web popup flow so the frontend can poll for the result
router.get('/google', (req, res, next) => {
  const oid = (req.query.oid || '').replace(/[^a-z0-9]/gi, '');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    ...(oid ? { state: oid } : {}),
  })(req, res, next);
});
router.get('/google/callback',
  (req, res, next) => {
    // Capture state before Passport processes it so oauthCallback can read it
    res.locals.oauthState = (req.query.state || '').replace(/[^a-z0-9]/gi, '');
    next();
  },
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  ctrl.oauthCallback
);

// Web popup polling endpoint — returns auth result once OAuth completes
router.get('/poll/:oid', ctrl.pollPending);

// Google OAuth (React Native mobile flow)
router.post('/google/mobile', authLimiter, ctrl.googleMobile);

// LinkedIn OAuth
router.get('/linkedin',
  passport.authenticate('linkedin', { session: false })
);
router.get('/linkedin/callback',
  passport.authenticate('linkedin', { session: false, failureRedirect: '/login' }),
  ctrl.oauthCallback
);

module.exports = router;
