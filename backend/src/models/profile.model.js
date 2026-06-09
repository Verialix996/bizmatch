const { query } = require('../config/db');

const PROFILE_FIELDS = [
  'bio', 'skills', 'hobbies', 'role_type',
  'portfolio_url', 'linkedin_url', 'experience', 'cv_url',
];
const INVESTOR_FIELDS = ['investment_domain', 'preferred_stage', 'max_investment'];

const ProfileModel = {
  async findByUserId(userId) {
    const rows = await query(
      `SELECT up.user_id, up.bio, up.skills, up.hobbies, up.role_type,
              up.portfolio_url, up.linkedin_url, up.experience, up.cv_url, up.photo_url,
              up.created_at, up.updated_at,
              ip.investment_domain, ip.preferred_stage, ip.max_investment
       FROM user_profiles up
       LEFT JOIN investor_profiles ip ON ip.user_id = up.user_id
       WHERE up.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  async create(userId, data) {
    return ProfileModel.upsert(userId, data);
  },

  async upsert(userId, data) {
    const nullIfEmpty = v => (v === '' || v === undefined ? null : v);
    const CONSTRAINED = ['preferred_stage', 'role_type'];
    const profileFields = [];
    const profileValues = [];
    for (const key of PROFILE_FIELDS) {
      if (data[key] !== undefined) {
        profileFields.push(key);
        let val = data[key];
        if (['skills', 'hobbies'].includes(key)) val = JSON.stringify(val);
        else if (CONSTRAINED.includes(key)) val = nullIfEmpty(val);
        profileValues.push(val);
      }
    }
    if (profileFields.length) {
      const cols = ['user_id', ...profileFields];
      const placeholders = cols.map(() => '?').join(', ');
      const updates = profileFields.map(f => `${f} = VALUES(${f})`).join(', ');
      await query(
        `INSERT INTO user_profiles (${cols.join(', ')})
         VALUES (${placeholders})
         ON DUPLICATE KEY UPDATE ${updates}`,
        [userId, ...profileValues]
      );
    }

    const roleType = data.role_type;
    if (roleType === 'investor') {
      const investorFields = [];
      const investorValues = [];
      for (const key of INVESTOR_FIELDS) {
        if (data[key] !== undefined) {
          investorFields.push(key);
          const val = CONSTRAINED.includes(key) ? nullIfEmpty(data[key]) : data[key];
          investorValues.push(val);
        }
      }
      if (investorFields.length) {
        const cols = ['user_id', ...investorFields];
        const placeholders = cols.map(() => '?').join(', ');
        const updates = investorFields.map(f => `${f} = VALUES(${f})`).join(', ');
        await query(
          `INSERT INTO investor_profiles (${cols.join(', ')})
           VALUES (${placeholders})
           ON DUPLICATE KEY UPDATE ${updates}`,
          [userId, ...investorValues]
        );
      }
    }
    return { userId };
  },

  async update(userId, data) {
    return ProfileModel.upsert(userId, data);
  },
};

module.exports = ProfileModel;
