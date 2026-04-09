const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/user.controller');

router.patch('/me',       authenticate, requireVerified, ctrl.updateMe);
router.delete('/me',      authenticate, ctrl.deleteAccount);
router.patch('/me/role',  authenticate, ctrl.setRole);
router.post('/me/photo',  authenticate, ctrl.uploadPhoto);
router.get('/:id',   authenticate, ctrl.getUser);
router.patch('/:id/verification', authenticate, ctrl.setVerificationStatus);

module.exports = router;
