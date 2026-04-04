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

// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  ctrl.oauthCallback
);

// LinkedIn OAuth
router.get('/linkedin',
  passport.authenticate('linkedin', { session: false })
);
router.get('/linkedin/callback',
  passport.authenticate('linkedin', { session: false, failureRedirect: '/login' }),
  ctrl.oauthCallback
);

module.exports = router;
