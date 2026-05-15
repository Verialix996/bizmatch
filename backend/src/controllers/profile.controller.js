const ProfileModel = require('../models/profile.model');
const UserModel = require('../models/user.model');
const { query } = require('../config/db');
const { uploadDoc: upload } = require('../middleware/upload');
const { moderateText } = require('../services/moderation.service');
const { cloudinary } = require('../config/cloudinary');

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
    const profile = await ProfileModel.create(req.user.id, {
      ...req.body,
      role_type: req.user.role,
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

// POST /api/profile/upload-cv  — CV/resume PDF upload
async function uploadCv(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'bizmatch/cvs', resource_type: 'raw', public_id: `cv_${req.user.id}.pdf`, overwrite: true },
        (err, r) => err ? reject(err) : resolve(r)
      );
      stream.end(req.file.buffer);
    });
    await query('UPDATE profiles SET cv_url = ? WHERE user_id = ?', [result.secure_url, req.user.id]);
    res.json({ cv_url: result.secure_url });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyProfile, createProfile, updateProfile, uploadIdDocument, upload, uploadCv };
