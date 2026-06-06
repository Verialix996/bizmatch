const ProfileModel = require('../models/profile.model');
const UserModel = require('../models/user.model');
const { query } = require('../config/db');
const { uploadDoc: upload } = require('../middleware/upload');
const { moderateText } = require('../services/moderation.service');
const { cloudinary } = require('../config/cloudinary');

// GET /api/profile/public/:userId
async function getPublicProfile(req, res, next) {
  try {
    const targetId = Number(req.params.userId);
    if (!targetId) return res.status(400).json({ error: 'userId required' });

    const rows = await query(
      `SELECT u.id, u.name, u.photo_url, u.role, u.is_premium, u.premium_expires_at,
              p.bio, p.role_type, p.skills, p.hobbies, p.investment_domain,
              p.preferred_stage, p.max_investment,
              proj.stage AS venture_stage, proj.funding_needed AS funding_needs
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN (
         SELECT pr.user_id, pr.stage, pr.funding_needed
         FROM projects pr
         INNER JOIN (SELECT user_id, MAX(id) AS max_id FROM projects WHERE is_active = 1 GROUP BY user_id) lp ON pr.id = lp.max_id
       ) proj ON proj.user_id = u.id
       WHERE u.id = ? AND u.deleted_at IS NULL`,
      [targetId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'User not found' });

    const safeParseArray = v => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } };

    res.json({
      userId: row.id,
      name: row.name,
      photoUrl: row.photo_url,
      role: row.role_type || row.role,
      isPremium: !!(row.is_premium && row.premium_expires_at && new Date(row.premium_expires_at) > new Date()),
      bio: row.bio || null,
      skills: safeParseArray(row.skills),
      hobbies: safeParseArray(row.hobbies),
      investmentDomain: row.investment_domain || null,
      preferredStage: row.preferred_stage || null,
      maxInvestment: row.max_investment || null,
      ventureStage: row.venture_stage || null,
      fundingNeeds: row.funding_needs || null,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/profile/me
async function getMyProfile(req, res, next) {
  try {
    const profile = await ProfileModel.findByUserId(req.user.id);
    const userRows = await query('SELECT photo_url FROM users WHERE id = ?', [req.user.id]);
    const photoUrl = userRows[0]?.photo_url || null;
    res.json(profile ? { ...profile, photo_url: photoUrl } : { photo_url: photoUrl });
  } catch (err) {
    next(err);
  }
}

// POST /api/profile
async function createProfile(req, res, next) {
  try {
    if (req.body.bio) {
      const mod = await moderateText(req.body.bio);
      if (!mod.ok) return res.status(400).json({ error: `Bio flagged by moderation: ${mod.reason}` });
    }
    if (req.body.experience) {
      const mod = await moderateText(req.body.experience);
      if (!mod.ok) return res.status(400).json({ error: `Experience flagged by moderation: ${mod.reason}` });
    }
    if (req.body.skills) {
      const skillsText = Array.isArray(req.body.skills) ? req.body.skills.join(' ') : String(req.body.skills);
      const mod = await moderateText(skillsText);
      if (!mod.ok) return res.status(400).json({ error: `Skills flagged by moderation: ${mod.reason}` });
    }
    const userRows = await query('SELECT role FROM users WHERE id = ?', [req.user.id]);
    const roleType = userRows[0]?.role || req.user.role;
    const profile = await ProfileModel.create(req.user.id, {
      ...req.body,
      role_type: roleType,
    });
    res.status(201).json(profile);
  } catch (err) {
    return res.status(500).json({ error: `[diag] ${err.errno || ''} ${err.sqlMessage || err.message}` });
  }
}

// PUT /api/profile
async function updateProfile(req, res, next) {
  try {
    if (req.body.bio) {
      const mod = await moderateText(req.body.bio);
      if (!mod.ok) return res.status(400).json({ error: `Bio flagged by moderation: ${mod.reason}` });
    }
    if (req.body.experience) {
      const mod = await moderateText(req.body.experience);
      if (!mod.ok) return res.status(400).json({ error: `Experience flagged by moderation: ${mod.reason}` });
    }
    if (req.body.skills) {
      const skillsText = Array.isArray(req.body.skills) ? req.body.skills.join(' ') : String(req.body.skills);
      const mod = await moderateText(skillsText);
      if (!mod.ok) return res.status(400).json({ error: `Skills flagged by moderation: ${mod.reason}` });
    }
    await ProfileModel.update(req.user.id, {
      ...req.body,
      role_type: req.user.role,
    });
    // Re-enter user into the match pool by clearing pass swipes targeting them
    await query("DELETE FROM swipes WHERE swiped_id = ? AND direction = 'pass'", [req.user.id]);
    // Invalidate cached AI scores so fresh ones are computed on next feed load
    query('DELETE FROM ai_match_scores WHERE user_id = ? OR candidate_id = ?', [req.user.id, req.user.id]).catch(() => {});
    res.json({ message: 'Profile updated' });
  } catch (err) {
    next(err);
  }
}

// POST /api/profile/upload-id  — ID document for verification
async function uploadIdDocument(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    await UserModel.setVerificationStatus(req.user.id, 'pending');
    res.json({ message: 'ID document uploaded. Pending review.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/profile/upload-cv  — stores CV bytes in DB as BLOB (Cloudinary free tier blocks raw file delivery)
async function uploadCv(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    await query(
      `INSERT INTO profiles (user_id, cv_data, cv_url)
       VALUES (?, ?, 'stored')
       ON DUPLICATE KEY UPDATE cv_data = VALUES(cv_data), cv_url = VALUES(cv_url)`,
      [req.user.id, req.file.buffer]
    );
    res.json({ cv_url: 'stored' });
  } catch (err) {
    next(err);
  }
}

// GET /api/profile/cv — serve CV PDF from DB (bypasses Cloudinary free-tier raw block)
const jwt = require('jsonwebtoken');
async function serveCv(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }

    const rows = await query('SELECT cv_data FROM profiles WHERE user_id = ?', [decoded.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    const cvData = rows[0].cv_data;
    if (!cvData || cvData.length === 0) return res.status(404).json({ error: 'No CV uploaded' });

    const buffer = Buffer.isBuffer(cvData) ? cvData : Buffer.from(cvData);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="cv.pdf"');
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { getMyProfile, getPublicProfile, createProfile, updateProfile, uploadIdDocument, upload, uploadCv, serveCv };
