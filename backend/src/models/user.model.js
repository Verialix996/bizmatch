const { query } = require('../config/db');

const USER_FULL_COLS = `
  u.id, u.email, u.name, u.role, u.is_verified, u.verification_status,
  u.deleted_at, u.created_at, u.updated_at,
  auth.password_hash, auth.otp_code, auth.otp_expires_at, auth.reset_token,
  auth.reset_token_expires, auth.oauth_provider, auth.oauth_provider_id,
  auth.two_factor_secret, auth.two_factor_enabled, auth.login_attempts, auth.locked_until,
  profile.photo_url, profile.bio, profile.skills, profile.hobbies, profile.role_type,
  profile.portfolio_url, profile.linkedin_url, profile.experience, profile.cv_url,
  investor.investment_domain, investor.preferred_stage, investor.max_investment,
  app.push_token, app.is_premium, app.premium_expires_at, app.last_active_at,
  app.swipe_count, app.swipe_count_date, app.has_seen_onboarding
`;

const USER_FULL_FROM = `
  FROM users u
  LEFT JOIN user_auth_security auth ON auth.user_id = u.id
  LEFT JOIN user_profiles profile ON profile.user_id = u.id
  LEFT JOIN investor_profiles investor ON investor.user_id = u.id
  LEFT JOIN user_app_state app ON app.user_id = u.id
`;

const UserModel = {
  async findById(id) {
    const rows = await query(
      `SELECT ${USER_FULL_COLS} ${USER_FULL_FROM} WHERE u.id = ? AND u.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const rows = await query(
      `SELECT ${USER_FULL_COLS} ${USER_FULL_FROM} WHERE u.email = ? AND u.deleted_at IS NULL`,
      [email]
    );
    return rows[0] || null;
  },

  async create({ email, passwordHash, role, name }) {
    const result = await query(
      'INSERT INTO users (email, role, name, is_verified) VALUES (?, ?, ?, 0)',
      [email, role, name]
    );
    await query('INSERT INTO user_auth_security (user_id, password_hash) VALUES (?, ?)', [result.insertId, passwordHash]);
    await query('INSERT INTO user_profiles (user_id, role_type) VALUES (?, ?)', [result.insertId, role || null]);
    await query('INSERT INTO user_app_state (user_id) VALUES (?)', [result.insertId]);
    if (role === 'investor') {
      await query('INSERT IGNORE INTO investor_profiles (user_id) VALUES (?)', [result.insertId]);
    } else if (role === 'entrepreneur') {
      await query('INSERT IGNORE INTO entrepreneur_profiles (user_id) VALUES (?)', [result.insertId]);
    }
    return { id: result.insertId, email, role, name, is_verified: 0 };
  },

  async findOrCreateOAuth({ provider, providerId, email, name, photo }) {
    // First: look up by provider ID (returning user via OAuth)
    const rows = await query(
      `SELECT ${USER_FULL_COLS} ${USER_FULL_FROM}
       WHERE auth.oauth_provider = ? AND auth.oauth_provider_id = ?`,
      [provider, providerId]
    );
    if (rows[0]) {
      if (!rows[0].is_verified) {
        await query('UPDATE users SET is_verified = 1 WHERE id = ?', [rows[0].id]);
        rows[0].is_verified = 1;
      }
      return rows[0];
    }

    // Second: check if this email already exists (e.g. registered with password)
    // If so, link the OAuth provider to the existing account
    const byEmail = await query(
      `SELECT ${USER_FULL_COLS} ${USER_FULL_FROM} WHERE u.email = ?`,
      [email]
    );
    if (byEmail[0]) {
      await query(
        'UPDATE user_auth_security SET oauth_provider = ?, oauth_provider_id = ? WHERE user_id = ?',
        [provider, providerId, byEmail[0].id]
      );
      await query('UPDATE users SET is_verified = 1 WHERE id = ?', [byEmail[0].id]);
      byEmail[0].oauth_provider = provider;
      byEmail[0].oauth_provider_id = providerId;
      byEmail[0].is_verified = 1;
      return byEmail[0];
    }

    const result = await query(
      'INSERT INTO users (email, name, is_verified) VALUES (?, ?, 1)',
      [email, name]
    );
    await query(
      'INSERT INTO user_auth_security (user_id, oauth_provider, oauth_provider_id) VALUES (?, ?, ?)',
      [result.insertId, provider, providerId]
    );
    await query('INSERT INTO user_profiles (user_id, photo_url) VALUES (?, ?)', [result.insertId, photo || null]);
    await query('INSERT INTO user_app_state (user_id) VALUES (?)', [result.insertId]);
    const newRows = await query(
      `SELECT ${USER_FULL_COLS} ${USER_FULL_FROM} WHERE u.id = ?`,
      [result.insertId]
    );
    return newRows[0];
  },

  async setVerified(id) {
    await query('UPDATE users SET is_verified = 1 WHERE id = ?', [id]);
  },

  async updatePassword(id, passwordHash) {
    await query('UPDATE user_auth_security SET password_hash = ? WHERE user_id = ?', [passwordHash, id]);
  },

  async setOtpCode(id, code, expiresAt) {
    await query(
      'UPDATE user_auth_security SET otp_code = ?, otp_expires_at = ? WHERE user_id = ?',
      [code, expiresAt ?? null, id]
    );
  },

  async setTwoFactorSecret(id, secret) {
    await query('UPDATE user_auth_security SET two_factor_secret = ? WHERE user_id = ?', [secret, id]);
  },

  async enableTwoFactor(id) {
    await query('UPDATE user_auth_security SET two_factor_enabled = 1 WHERE user_id = ?', [id]);
  },

  async disableTwoFactor(id) {
    await query('UPDATE user_auth_security SET two_factor_enabled = 0, two_factor_secret = NULL WHERE user_id = ?', [id]);
  },

  async setResetToken(id, token, expiresAt) {
    await query(
      'UPDATE user_auth_security SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
      [token, expiresAt ?? null, id]
    );
  },

  async findByResetToken(token) {
    const rows = await query(
      `SELECT ${USER_FULL_COLS} ${USER_FULL_FROM}
       WHERE auth.reset_token = ? AND auth.reset_token_expires > NOW()`,
      [token]
    );
    return rows[0] || null;
  },

  async updateName(id, name) {
    await query('UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?', [name, id]);
  },

  async hardDelete(id) {
    await query('DELETE FROM users WHERE id = ?', [id]);
  },

  async setVerificationStatus(id, status) {
    await query('UPDATE users SET verification_status = ? WHERE id = ?', [status, id]);
  },

  async setRole(id, role) {
    await query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    await query('UPDATE user_profiles SET role_type = ? WHERE user_id = ?', [role, id]);
    if (role === 'investor') {
      await query('INSERT IGNORE INTO investor_profiles (user_id) VALUES (?)', [id]);
      await query('DELETE FROM entrepreneur_profiles WHERE user_id = ?', [id]);
    } else if (role === 'entrepreneur') {
      await query('INSERT IGNORE INTO entrepreneur_profiles (user_id) VALUES (?)', [id]);
      await query('DELETE FROM investor_profiles WHERE user_id = ?', [id]);
    }
  },

  async updatePhoto(id, photoUrl) {
    await query('UPDATE user_profiles SET photo_url = ? WHERE user_id = ?', [photoUrl, id]);
  },

  async updateLoginAttempts(id, attempts, lockedUntil) {
    await query(
      'UPDATE user_auth_security SET login_attempts = ?, locked_until = ? WHERE user_id = ?',
      [attempts, lockedUntil ?? null, id]
    );
  },

  async setHasSeenOnboarding(id) {
    await query('UPDATE user_app_state SET has_seen_onboarding = 1 WHERE user_id = ?', [id]);
  },
};

module.exports = UserModel;
