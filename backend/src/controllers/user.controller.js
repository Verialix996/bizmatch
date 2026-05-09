const UserModel = require('../models/user.model');
const logger = require('../utils/logger');
const { uploadPhoto: photoUpload } = require('../middleware/upload');
const { query } = require('../config/db');

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

// PATCH /api/users/me/push-token
async function savePushToken(req, res, next) {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ error: 'pushToken required' });
    await query('UPDATE users SET push_token = ? WHERE id = ?', [pushToken, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/users/me/premium/activate
async function activatePremium(req, res, next) {
  try {
    await query(
      "UPDATE users SET is_premium = 1, premium_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = ?",
      [req.user.id]
    );
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    res.json({ ok: true, expiresAt });
  } catch (err) { next(err); }
}

// GET /api/users/me/who-liked-me  (premium only)
async function whoLikedMe(req, res, next) {
  try {
    const userRows = await query(
      'SELECT is_premium, premium_expires_at FROM users WHERE id = ?',
      [req.user.id]
    );
    const u = userRows[0];
    const isPremium = u?.is_premium && new Date(u?.premium_expires_at) > new Date();
    if (!isPremium) return res.status(403).json({ error: 'Premium required' });

    const rows = await query(
      `SELECT u.id, u.name, u.photo_url AS photoUrl, s.is_super_like AS isSuperLike
       FROM swipes s
       JOIN users u ON u.id = s.swiper_id
       WHERE s.swiped_id = ? AND s.direction = 'like' AND u.deleted_at IS NULL`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { updateMe, deleteAccount, getUser, setVerificationStatus, setRole, uploadPhoto, savePushToken, activatePremium, whoLikedMe };
