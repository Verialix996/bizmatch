const UserModel = require('../models/user.model');
const logger = require('../utils/logger');
const { uploadPhoto: photoUpload } = require('../middleware/upload');

// PATCH /api/users/me
async function updateMe(req, res, next) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty.' });
    }
    await UserModel.updateName(req.user.id, name.trim());
    res.json({ name: name.trim() });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/users/me
async function deleteAccount(req, res, next) {
  try {
    await UserModel.hardDelete(req.user.id);
    logger.info(`Account deleted: ${req.user.email}`);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
}

// GET /api/users/:id  (admin / moderation use)
async function getUser(req, res, next) {
  try {
    const user = await UserModel.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, otp_code, reset_token, two_factor_secret, ...safe } = user;
    res.json(safe);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/:id/verification  (admin)
async function setVerificationStatus(req, res, next) {
  try {
    const { status } = req.body; // 'pending' | 'verified' | 'rejected'
    await UserModel.setVerificationStatus(req.params.id, status);
    res.json({ message: 'Verification status updated' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/users/me/role
async function setRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!['entrepreneur', 'investor'].includes(role)) {
      return res.status(400).json({ error: 'role must be entrepreneur or investor' });
    }
    await UserModel.setRole(req.user.id, role);
    res.json({ role });
  } catch (err) {
    next(err);
  }
}

// POST /api/users/me/photo
function uploadPhoto(req, res, next) {
  photoUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image provided' });

    const photoUrl = req.file.path;
    try {
      await UserModel.updatePhoto(req.user.id, photoUrl);
      res.json({ photo_url: photoUrl });
    } catch (e) {
      next(e);
    }
  });
}

module.exports = { updateMe, deleteAccount, getUser, setVerificationStatus, setRole, uploadPhoto };
