const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { getMyProfile, getPublicProfile, createProfile, updateProfile, uploadCv, serveCv } =
  require('../controllers/profile.controller');
const { uploadCv: uploadCvMiddleware } = require('../middleware/upload');

router.get('/public/:userId', authenticate, getPublicProfile);
router.get('/',         authenticate, requireVerified, getMyProfile);
router.post('/',        authenticate, requireVerified, createProfile);
router.put('/',         authenticate, requireVerified, updateProfile);
router.post('/upload-cv',
  authenticate,
  requireVerified,
  uploadCvMiddleware,
  uploadCv
);
router.get('/cv', serveCv);

module.exports = router;
