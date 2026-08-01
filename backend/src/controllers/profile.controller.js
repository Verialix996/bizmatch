const ProfileModel = require('../models/profile.model');
const { query } = require('../config/db');
const supabase = require('../config/supabase');
const { moderateText } = require('../services/moderation.service');
const { preScoreUser } = require('../models/match.model');

// GET /api/profile/public/:userId
async function getPublicProfile(req, res, next) {
  try {
    const targetId = req.params.userId;
    if (!targetId) return res.status(400).json({ error: 'userId required' });

    const rows = await query(
      `SELECT u.id, u.name, u.photo_url, u.role, u.is_premium, u.premium_expires_at,
              u.bio, u.skills, u.hobbies, ip.investment_domain,
              ip.preferred_stage, ip.max_investment,
              proj.stage AS venture_stage, proj.funding_needed AS funding_needs
       FROM users u
       LEFT JOIN investor_profiles ip ON ip.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT p.stage, p.funding_needed
         FROM projects p
         WHERE p.user_id = u.id AND p.is_active = true
         ORDER BY p.id DESC LIMIT 1
       ) proj ON true
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [targetId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'User not found' });

    res.json({
      userId: row.id,
      name: row.name,
      photoUrl: row.photo_url,
      role: row.role,
      isPremium: !!(row.is_premium && row.premium_expires_at && new Date(row.premium_expires_at) > new Date()),
      bio: row.bio || null,
      skills: row.skills || [],
      hobbies: row.hobbies || [],
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
    res.json(profile || {});
  } catch (err) {
    next(err);
  }
}

async function moderateProfileFields(body) {
  if (body.bio) {
    const mod = await moderateText(body.bio);
    if (!mod.ok) return `Bio flagged by moderation: ${mod.reason}`;
  }
  if (body.experience) {
    const mod = await moderateText(body.experience);
    if (!mod.ok) return `Experience flagged by moderation: ${mod.reason}`;
  }
  if (body.skills) {
    const skillsText = Array.isArray(body.skills) ? body.skills.join(' ') : String(body.skills);
    const mod = await moderateText(skillsText);
    if (!mod.ok) return `Skills flagged by moderation: ${mod.reason}`;
  }
  return null;
}

// POST /api/profile
async function createProfile(req, res, next) {
  try {
    const modError = await moderateProfileFields(req.body);
    if (modError) return res.status(400).json({ error: modError });

    const profile = await ProfileModel.create(req.user.id, {
      ...req.body,
      role_type: req.user.role,
    });
    res.status(201).json(profile);
    preScoreUser(req.user.id).catch(() => {});
  } catch (err) {
    next(err);
  }
}

// PUT /api/profile
async function updateProfile(req, res, next) {
  try {
    const modError = await moderateProfileFields(req.body);
    if (modError) return res.status(400).json({ error: modError });

    await ProfileModel.update(req.user.id, {
      ...req.body,
      role_type: req.user.role,
    });
    // Re-enter user into the match pool by clearing pass swipes targeting them
    await query("DELETE FROM swipes WHERE swiped_id = $1 AND direction = 'pass'", [req.user.id]);
    res.json({ message: 'Profile updated' });
    // Re-score against all candidates in background (clears old scores internally)
    preScoreUser(req.user.id).catch(() => {});
  } catch (err) {
    next(err);
  }
}

// POST /api/profile/upload-cv  — uploads to Cloudinary, stores URL
async function uploadCv(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = req.file.path; // Cloudinary secure URL
    await query('UPDATE users SET cv_url = $1 WHERE id = $2', [url, req.user.id]);
    res.json({ cv_url: url });
  } catch (err) {
    next(err);
  }
}

// GET /api/profile/cv — proxy from Cloudinary with correct Content-Type (fixes octet-stream delivery)
async function serveCv(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid token' });

    const rows = await query('SELECT cv_url FROM users WHERE id = $1', [data.user.id]);
    const cvUrl = rows[0]?.cv_url;
    if (!cvUrl) return res.status(404).json({ error: 'No CV uploaded' });

    const response = await fetch(cvUrl);
    if (!response.ok) return res.status(502).json({ error: 'Failed to fetch CV from storage' });
    const buf = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="cv.pdf"');
    res.send(buf);
  } catch (err) { next(err); }
}

module.exports = { getMyProfile, getPublicProfile, createProfile, updateProfile, uploadCv, serveCv };
