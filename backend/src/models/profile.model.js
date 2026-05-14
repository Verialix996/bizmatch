const { query } = require('../config/db');

const ProfileModel = {
  async findByUserId(userId) {
    const rows = await query('SELECT * FROM profiles WHERE user_id = ?', [userId]);
    return rows[0] || null;
  },

  async create(userId, data) {
    const { bio, skills, hobbies, role_type, venture_stage, funding_needs,
            investment_domain, preferred_stage, max_investment,
            portfolio_url, linkedin_url, experience, cv_url } = data;
    const nullIfEmpty = v => (v === '' || v === undefined ? null : v);
    const vals = [
      userId,
      nullIfEmpty(bio),
      JSON.stringify(skills || []),
      JSON.stringify(hobbies || []),
      nullIfEmpty(role_type),
      nullIfEmpty(venture_stage),
      funding_needs || null,
      nullIfEmpty(investment_domain),
      nullIfEmpty(preferred_stage),
      max_investment || null,
      nullIfEmpty(portfolio_url),
      nullIfEmpty(linkedin_url),
      nullIfEmpty(experience),
      nullIfEmpty(cv_url),
    ];
    const result = await query(
      `INSERT INTO profiles
        (user_id, bio, skills, hobbies, role_type,
         venture_stage, funding_needs,
         investment_domain, preferred_stage, max_investment,
         portfolio_url, linkedin_url, experience, cv_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         bio = VALUES(bio),
         skills = VALUES(skills),
         hobbies = VALUES(hobbies),
         role_type = VALUES(role_type),
         venture_stage = VALUES(venture_stage),
         funding_needs = VALUES(funding_needs),
         investment_domain = VALUES(investment_domain),
         preferred_stage = VALUES(preferred_stage),
         max_investment = VALUES(max_investment),
         portfolio_url = VALUES(portfolio_url),
         linkedin_url = VALUES(linkedin_url),
         experience = VALUES(experience),
         cv_url = VALUES(cv_url)`,
      vals
    );
    return { id: result.insertId, userId };
  },

  async update(userId, data) {
    const allowed = [
      'bio', 'skills', 'hobbies', 'role_type',
      'venture_stage', 'funding_needs',
      'investment_domain', 'preferred_stage', 'max_investment',
      'portfolio_url', 'linkedin_url', 'experience', 'cv_url',
    ];
    const fields = [];
    const values = [];
    const nullIfEmpty = v => (v === '' || v === undefined ? null : v);
    const CONSTRAINED = ['venture_stage', 'preferred_stage', 'role_type'];
    for (const key of allowed) {
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
    await query(`UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, values);
  },
};

module.exports = ProfileModel;
