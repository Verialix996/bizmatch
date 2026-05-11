const { query } = require('../config/db');

const UserModel = {
  async findById(id) {
    const rows = await query('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [id]);
    return rows[0] || null;
  },

  async findByEmail(email) {
    const rows = await query('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [email]);
    return rows[0] || null;
  },

  async create({ email, passwordHash, role, name }) {
    const result = await query(
      'INSERT INTO users (email, password_hash, role, name, is_verified) VALUES (?, ?, ?, ?, 0)',
      [email, passwordHash, role, name]
    );
    return { id: result.insertId, email, role, name };
  },

  async findOrCreateOAuth({ provider, providerId, email, name, photo }) {
    const rows = await query(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ?',
      [provider, providerId]
    );
    if (rows[0]) {
      if (!rows[0].is_verified) {
        await query('UPDATE users SET is_verified = 1 WHERE id = ?', [rows[0].id]);
        rows[0].is_verified = 1;
      }
      return rows[0];
    }

    const result = await query(
      'INSERT INTO users (email, name, photo_url, oauth_provider, oauth_provider_id, is_verified) VALUES (?, ?, ?, ?, ?, 1)',
      [email, name, photo, provider, providerId]
    );
    const newRows = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return newRows[0];
  },

  async setVerified(id) {
    await query('UPDATE users SET is_verified = 1 WHERE id = ?', [id]);
  },

  async updatePassword(id, passwordHash) {
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  },

  async setOtpCode(id, code, expiresAt) {
    await query(
      'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
      [code, expiresAt ?? null, id]
    );
  },

  async setTwoFactorSecret(id, secret) {
    await query('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret, id]);
  },

  async enableTwoFactor(id) {
    await query('UPDATE users SET two_factor_enabled = 1 WHERE id = ?', [id]);
  },

  async disableTwoFactor(id) {
    await query('UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL WHERE id = ?', [id]);
  },

  async setResetToken(id, token, expiresAt) {
    await query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [token, expiresAt ?? null, id]
    );
  },

  async findByResetToken(token) {
    const rows = await query(
      'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
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
  },

  async updatePhoto(id, photoUrl) {
    await query('UPDATE users SET photo_url = ? WHERE id = ?', [photoUrl, id]);
  },

  async updateLoginAttempts(id, attempts, lockedUntil) {
    await query(
      'UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?',
      [attempts, lockedUntil ?? null, id]
    );
  },
};

module.exports = UserModel;
