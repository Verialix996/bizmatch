const { query } = require('../config/db');

const PROFILE_FIELDS = [
  'bio', 'skills', 'hobbies', 'role_type',
  'investment_domain', 'preferred_stage', 'max_investment',
  'portfolio_url', 'linkedin_url', 'experience', 'cv_url',
];

const ProfileModel = {
  async findByUserId(userId) {
    const rows = await query(
      `SELECT id AS user_id, ${PROFILE_FIELDS.join(', ')}, photo_url, created_at, updated_at
       FROM users WHERE id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    return ProfileModel.upsert(userId, data);
  },

  async upsert(userId, data) {
    const nullIfEmpty = v => (v === '' || v === undefined ? null : v);
    const fields = [];
    const values = [];
    const CONSTRAINED = ['preferred_stage', 'role_type'];
    for (const key of PROFILE_FIELDS) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        let val = data[key];
        if (['skills', 'hobbies'].includes(key)) val = JSON.stringify(val);
        else if (CONSTRAINED.includes(key)) val = nullIfEmpty(val);
        values.push(val);
      }
    }
    if (!fields.length) return;
    values.push(userId);
    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
    return { userId };
  },

  async update(userId, data) {
    return ProfileModel.upsert(userId, data);
  },
};

module.exports = ProfileModel;
