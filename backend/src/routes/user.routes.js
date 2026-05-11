const router = require('express').Router();
const { authenticate, requireVerified, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/user.controller');

router.patch('/me',                     authenticate, requireVerified, ctrl.updateMe);
router.post('/me/verify-self',          authenticate, ctrl.verifySelf);
router.delete('/me',                    authenticate, ctrl.deleteAccount);
router.patch('/me/role',                authenticate, ctrl.setRole);
router.post('/me/photo',                authenticate, ctrl.uploadPhoto);
router.patch('/me/push-token',          authenticate, ctrl.savePushToken);
router.post('/me/premium/activate',     authenticate, ctrl.activatePremium);
router.delete('/me/premium',            authenticate, ctrl.cancelPremium);
router.get('/me/who-liked-me',          authenticate, ctrl.whoLikedMe);
router.get('/:id',                      authenticate, ctrl.getUser);
router.patch('/:id/verification',       authenticate, requireAdmin, ctrl.setVerificationStatus);

module.exports = router;
