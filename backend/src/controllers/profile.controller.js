const ProfileModel = require('../models/profile.model');
const UserModel = require('../models/user.model');
const { query } = require('../config/db');
const { uploadDoc: upload } = require('../middleware/upload');

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
    const profile = await ProfileModel.create(req.user.id, {
      ...req.body,
      role_type: req.user.role,
    });
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
}

// PUT /api/profile
async function updateProfile(req, res, next) {
  try {
    await ProfileModel.update(req.user.id, {
      ...req.body,
      role_type: req.user.role,
    });
    // Re-enter user into the match pool by clearing pass swipes targeting them
    await query("DELETE FROM swipes WHERE swiped_id = ? AND direction = 'pass'", [req.user.id]);
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

module.exports = { getMyProfile, createProfile, updateProfile, uploadIdDocument, upload };
