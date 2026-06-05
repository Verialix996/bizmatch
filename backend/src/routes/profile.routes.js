const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { getMyProfile, createProfile, updateProfile, uploadIdDocument, upload, uploadCv, serveCv } =
  require('../controllers/profile.controller');
const { uploadCvMemory: uploadCvMiddleware } = require('../middleware/upload');

router.get('/',         authenticate, requireVerified, getMyProfile);
router.post('/',        authenticate, requireVerified, createProfile);
router.put('/',         authenticate, requireVerified, updateProfile);
router.post('/upload-id',
  authenticate,
  requireVerified,
  upload,
  uploadIdDocument
);
router.post('/upload-cv',
  authenticate,
  requireVerified,
  uploadCvMiddleware,
  uploadCv
);
router.get('/cv', serveCv);

module.exports = router;
