const ProfileModel = require('../models/profile.model');
const UserModel = require('../models/user.model');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || 'uploads/',
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

// GET /api/profile/me
async function getMyProfile(req, res, next) {
  try {
    const profile = await ProfileModel.findByUserId(req.user.id);
    res.json(profile || {});
  } catch (err) {
    next(err);
  }
}

// POST /api/profile
async function createProfile(req, res, next) {
  try {
    const profile = await ProfileModel.create(req.user.id, req.body);
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
}

// PUT /api/profile
async function updateProfile(req, res, next) {
  try {
    await ProfileModel.update(req.user.id, req.body);
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
