const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const UserModel = require('../models/user.model');
const ProfileModel = require('../models/profile.model');
const { sendOtp, sendPasswordReset } = require('../services/email.service');
const { moderateText } = require('../services/moderation.service');
const logger = require('../utils/logger');

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { email, password, name, role } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (name) {
      const nameMod = await moderateText(name);
      if (!nameMod.ok) return res.status(400).json({ error: `Name flagged by moderation: ${nameMod.reason}` });
    }

    const existing = await UserModel.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await UserModel.create({ email, passwordHash, name, role });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await UserModel.setOtpCode(user.id, otp, expiresAt);

    logger.info(`New registration: ${email}`);
    res.status(201).json({ message: 'Registered. Check your email for the verification code.' });

    // Send email after responding so SMTP latency/failure doesn't block the client
    sendOtp(email, otp).catch(err => logger.error(`OTP email failed for ${email}: ${err.message}`));
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findByEmail(email);

    if (!user || !user.password_hash) {
      logger.warn(`Failed login attempt: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({ error: `Account locked. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.` });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const attempts = (user.login_attempts || 0) + 1;
      const lock = attempts >= 5
        ? { login_attempts: 0, locked_until: new Date(Date.now() + 15 * 60 * 1000) }
        : { login_attempts: attempts, locked_until: null };
      await UserModel.updateLoginAttempts(user.id, lock.login_attempts, lock.locked_until);
      logger.warn(`Failed login attempt ${attempts}/5: ${email}`);
      const msg = attempts >= 5
        ? 'Too many failed attempts. Account locked for 15 minutes.'
        : `Invalid credentials (${attempts}/5 attempts)`;
      return res.status(401).json({ error: msg });
    }

    // Successful login — reset lockout
    await UserModel.updateLoginAttempts(user.id, 0, null);

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Email not verified', needsVerification: true });
    }

    if (user.two_factor_enabled) {
      return res.status(200).json({ requires2FA: true, userId: user.id });
    }

    const profile = await ProfileModel.findByUserId(user.id);
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, has_profile: !!profile, is_premium: user.is_premium, premium_expires_at: user.premium_expires_at, photo_url: user.photo_url, two_factor_enabled: !!user.two_factor_enabled } });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verify-email
async function verifyEmail(req, res, next) {
  try {
    const { email, code } = req.body;
    const user = await UserModel.findByEmail(email);

    if (!user || user.otp_code !== code || new Date(user.otp_expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    await UserModel.setVerified(user.id);
    await UserModel.setOtpCode(user.id, null, null);

    const token = generateToken(user);
    res.json({ message: 'Email verified', token, user: { id: user.id, email: user.email, name: user.name, role: user.role, has_profile: false, is_premium: user.is_premium, premium_expires_at: user.premium_expires_at, photo_url: user.photo_url, two_factor_enabled: !!user.two_factor_enabled } });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res, next) {
  try {
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await UserModel.setOtpCode(user.id, otp, expiresAt);
    res.json({ message: 'Verification code resent' });

    sendOtp(email, otp).catch(err => logger.error(`Resend OTP email failed for ${email}: ${err.message}`));
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = await UserModel.findByEmail(email);
    // Always respond 200 to avoid email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link was sent.' });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await UserModel.setResetToken(user.id, token, expiresAt);

    const primaryFrontend = (process.env.FRONTEND_URL || '').split(',')[0].trim();
    const resetUrl = `${primaryFrontend}/reset-password?token=${token}`;
    res.json({ message: 'If that email exists, a reset link was sent.' });

    sendPasswordReset(email, resetUrl).catch(err => logger.error(`Reset email failed for ${email}: ${err.message}`));
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const user = await UserModel.findByResetToken(token);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await UserModel.updatePassword(user.id, passwordHash);
    await UserModel.setResetToken(user.id, null, null);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/setup
async function setup2FA(req, res, next) {
  try {
    const secret = speakeasy.generateSecret({ name: `BizMatch (${req.user.email})` });
    await UserModel.setTwoFactorSecret(req.user.id, secret.base32);
    res.json({ secret: secret.base32, otpauthUrl: secret.otpauth_url });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/verify
async function verify2FA(req, res, next) {
  try {
    const { token } = req.body;
    const user = req.user;

    const valid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
    });

    if (!valid) return res.status(400).json({ error: 'Invalid 2FA code' });

    await UserModel.enableTwoFactor(user.id);
    res.json({ message: '2FA enabled' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/disable
async function disableTwoFactor(req, res, next) {
  try {
    const { token } = req.body;
    const user = req.user;

    if (!user.two_factor_secret) return res.status(400).json({ error: '2FA is not enabled' });

    const valid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
    });

    if (!valid) return res.status(400).json({ error: 'Invalid 2FA code' });

    await UserModel.disableTwoFactor(user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// In-memory store for pending web OAuth results { oid -> { token, userId, ... , createdAt } }
const pendingAuths = new Map();
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, entry] of pendingAuths) {
    if (entry.createdAt < cutoff) pendingAuths.delete(id);
  }
}, 60_000);

// OAuth callback — handles both mobile (bizmatch:// deep link) and web popup (polling)
async function oauthCallback(req, res) {
  const user = req.user;
  const oid = res.locals.oauthState;  // set by middleware in auth.routes.js
  const profile = await ProfileModel.findByUserId(user.id);
  const has_profile = !!profile;

  // If 2FA is enabled, don't issue a token yet — require TOTP verification first
  if (user.two_factor_enabled) {
    if (oid) {
      pendingAuths.set(oid, { requires2FA: true, userId: String(user.id), createdAt: Date.now() });
      return res.send('<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8f9fc;font-family:sans-serif;color:#aaa;font-size:14px;}</style></head><body><script>try{if(window.opener&&!window.opener.closed){window.opener.postMessage("bizmatch-oauth-done","*");}}catch(e){}window.close();</script></body></html>');
    }
    const params = new URLSearchParams({ requires2FA: 'true', userId: String(user.id) });
    return res.redirect(`bizmatch://auth?${params.toString()}`);
  }

  const token = generateToken(user);

  if (oid) {
    // Web popup flow: store result, close the popup, frontend polls /api/auth/poll/:oid
    pendingAuths.set(oid, {
      token,
      userId: String(user.id),
      email:  user.email || '',
      name:   user.name  || '',
      role:   user.role  || '',
      has_profile,
      is_premium: user.is_premium || 0,
      premium_expires_at: user.premium_expires_at || '',
      photo_url: user.photo_url || '',
      two_factor_enabled: user.two_factor_enabled ? 1 : 0,
      createdAt: Date.now(),
    });
    return res.send('<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#f8f9fc;font-family:sans-serif;color:#aaa;font-size:14px;}</style></head><body><script>try{if(window.opener&&!window.opener.closed){window.opener.postMessage("bizmatch-oauth-done","*");}}catch(e){}window.close();</script></body></html>');
  }

  // Mobile flow: HTTP 302 redirect to bizmatch:// deep link (intercepted by WebBrowser.openAuthSessionAsync)
  const params = new URLSearchParams({
    token,
    userId: String(user.id),
    email:  user.email || '',
    name:   user.name  || '',
    role:   user.role  || '',
    has_profile: String(has_profile),
    is_premium: String(user.is_premium || 0),
    premium_expires_at: user.premium_expires_at || '',
    photo_url: user.photo_url || '',
    two_factor_enabled: String(user.two_factor_enabled ? 1 : 0),
  });
  return res.redirect(`bizmatch://auth?${params.toString()}`);
}

// GET /api/auth/poll/:oid — frontend polls this after opening the OAuth popup
function pollPending(req, res) {
  const oid = req.params.oid.replace(/[^a-z0-9]/gi, '');
  const entry = pendingAuths.get(oid);
  if (!entry) return res.status(202).json({ pending: true });
  pendingAuths.delete(oid);
  const { createdAt: _c, ...data } = entry;
  res.json(data);
}

// POST /api/auth/google/mobile — accepts Google access token from React Native
async function googleMobile(req, res, next) {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    // Fetch user info from Google
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`
    );
    if (!response.ok) return res.status(401).json({ error: 'Invalid Google access token' });

    const profile = await response.json();

    const user = await UserModel.findOrCreateOAuth({
      provider:   'google',
      providerId: profile.sub,
      email:      profile.email,
      name:       (profile.name || '').replace(/\+/g, ' ').trim(),
      photo:      profile.picture ?? null,
    });

    if (user.two_factor_enabled) {
      return res.json({ requires2FA: true, userId: user.id });
    }

    const userProfile = await ProfileModel.findByUserId(user.id);
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, has_profile: !!userProfile, is_premium: user.is_premium, premium_expires_at: user.premium_expires_at, photo_url: user.photo_url, two_factor_enabled: !!user.two_factor_enabled } });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/2fa/login — verifies TOTP at login time (no auth token required yet)
async function login2FA(req, res, next) {
  try {
    const { userId, token } = req.body;
    if (!userId || !token) return res.status(400).json({ error: 'userId and token are required' });

    const user = await UserModel.findById(Number(userId));
    if (!user || !user.two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Invalid 2FA request' });
    }

    const valid = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) return res.status(400).json({ error: 'Invalid 2FA code' });

    const profile = await ProfileModel.findByUserId(user.id);
    const jwtToken = generateToken(user);
    res.json({
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, has_profile: !!profile, is_premium: user.is_premium, premium_expires_at: user.premium_expires_at, photo_url: user.photo_url, two_factor_enabled: !!user.two_factor_enabled },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register, login, verifyEmail, resendOtp,
  forgotPassword, resetPassword,
  setup2FA, verify2FA, disableTwoFactor, login2FA, oauthCallback, pollPending, googleMobile,
};
