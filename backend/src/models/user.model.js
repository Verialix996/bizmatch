const { getDb } = require('../config/db');

const UserModel = {
  findById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  },

  findByEmail(email) {
    return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
  },

  create({ email, passwordHash, role, name }) {
    const result = getDb().prepare(
      'INSERT INTO users (email, password_hash, role, name, is_verified) VALUES (?, ?, ?, ?, 0)'
    ).run(email, passwordHash, role, name);
    return { id: result.lastInsertRowid, email, role, name };
  },

  findOrCreateOAuth({ provider, providerId, email, name, photo }) {
    const existing = getDb().prepare(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ?'
    ).get(provider, providerId);
    if (existing) return existing;

    const result = getDb().prepare(
      'INSERT INTO users (email, name, photo_url, oauth_provider, oauth_provider_id, is_verified) VALUES (?, ?, ?, ?, ?, 1)'
    ).run(email, name, photo, provider, providerId);
    return { id: result.lastInsertRowid, email, name };
  },

  setVerified(id) {
    getDb().prepare('UPDATE users SET is_verified = 1 WHERE id = ?').run(id);
  },

  updatePassword(id, passwordHash) {
    getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
  },

  setOtpCode(id, code, expiresAt) {
    getDb().prepare('UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?')
      .run(code, expiresAt ? expiresAt.toISOString() : null, id);
  },

  setTwoFactorSecret(id, secret) {
    getDb().prepare('UPDATE users SET two_factor_secret = ? WHERE id = ?').run(secret, id);
  },

  enableTwoFactor(id) {
    getDb().prepare('UPDATE users SET two_factor_enabled = 1 WHERE id = ?').run(id);
  },

  setResetToken(id, token, expiresAt) {
    getDb().prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?')
      .run(token, expiresAt ? expiresAt.toISOString() : null, id);
  },

  findByResetToken(token) {
    return getDb().prepare(
      "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > datetime('now')"
    ).get(token) || null;
  },

  softDelete(id) {
    getDb().prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(id);
  },

  setVerificationStatus(id, status) {
    getDb().prepare('UPDATE users SET verification_status = ? WHERE id = ?').run(status, id);
  },
};

module.exports = UserModel;
