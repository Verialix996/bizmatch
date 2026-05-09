const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { getMyProfile, createProfile, updateProfile, uploadIdDocument, upload } =
  require('../controllers/profile.controller');

router.get('/',         authenticate, requireVerified, getMyProfile);
router.post('/',        authenticate, requireVerified, createProfile);
router.put('/',         authenticate, requireVerified, updateProfile);
router.post('/upload-id',
  authenticate,
  requireVerified,
  upload,
  uploadIdDocument
);

module.exports = router;
