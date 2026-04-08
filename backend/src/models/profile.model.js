const { getDb } = require('../config/db');

const ProfileModel = {
  findByUserId(userId) {
    return getDb().prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) || null;
  },

  create(userId, data) {
    const { bio, skills, hobbies, role_type, venture_stage, funding_needs,
            investment_domain, preferred_stage, max_investment } = data;
    const result = getDb().prepare(
      `INSERT INTO profiles
        (user_id, bio, skills, hobbies, role_type,
         venture_stage, funding_needs,
         investment_domain, preferred_stage, max_investment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId, bio || null,
      JSON.stringify(skills || []), JSON.stringify(hobbies || []),
      role_type || null,
      venture_stage || null, funding_needs || null,
      investment_domain || null, preferred_stage || null, max_investment || null
    );
    return { id: result.lastInsertRowid, userId };
  },

  update(userId, data) {
    const allowed = [
      'bio', 'skills', 'hobbies', 'role_type',
      'venture_stage', 'funding_needs',
      'investment_domain', 'preferred_stage', 'max_investment',
    ];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        const val = ['skills', 'hobbies'].includes(key) ? JSON.stringify(data[key]) : data[key];
        values.push(val === '' ? null : val);
      }
    }
    if (!fields.length) return;
    values.push(userId);
    getDb().prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...values);
  },
};

module.exports = ProfileModel;
