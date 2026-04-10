const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const UserModel = require('../models/user.model');
const { sendOtp, sendPasswordReset } = require('../services/email.service');
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

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      logger.warn(`Failed login attempt: ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: 'Email not verified', needsVerification: true });
    }

    if (user.two_factor_enabled) {
      return res.status(200).json({ requires2FA: true, userId: user.id });
    }

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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
    res.json({ message: 'Email verified', token });
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

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
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

// OAuth callback — issue JWT after OAuth success, deep-link back to mobile app
// On web (popup), uses postMessage instead of bizmatch:// deep link
function oauthCallback(req, res) {
  const user = req.user;
  const token = generateToken(user);
  const params = new URLSearchParams({
    token,
    userId: String(user.id),
    email:  user.email  || '',
    name:   user.name   || '',
    role:   user.role   || '',
  });
  const paramsStr = params.toString();
  const deepLink = `bizmatch://auth?${paramsStr}`;

  // Return an HTML page that handles both environments:
  // - Web popup (window.opener is set): postMessage to parent then close
  // - Mobile in-app browser (no opener): navigate to bizmatch:// deep link
  res.send(`<!DOCTYPE html><html><head><title>Signing in...</title></head><body>
<script>
  var p = ${JSON.stringify(paramsStr)};
  if (window.opener) {
    window.opener.postMessage({ type: 'bizmatch-auth', params: p }, '*');
    window.close();
  } else {
    window.location.href = ${JSON.stringify(deepLink)};
  }
</script>
<p style="font-family:sans-serif;text-align:center;margin-top:60px;color:#555">Signing you in&hellip;</p>
</body></html>`);
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

    // If this email is already registered with a different auth method, reject cleanly
    const existing = await UserModel.findByEmail(profile.email);
    if (existing && existing.oauth_provider !== 'google') {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in with your email and password.' });
    }

    const user = await UserModel.findOrCreateOAuth({
      provider:   'google',
      providerId: profile.sub,
      email:      profile.email,
      name:       (profile.name || '').replace(/\+/g, ' ').trim(),
      photo:      profile.picture ?? null,
    });

    const token = generateToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register, login, verifyEmail, resendOtp,
  forgotPassword, resetPassword,
  setup2FA, verify2FA, oauthCallback, googleMobile,
};
