const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/user.controller');

router.delete('/me',      authenticate, requireVerified, ctrl.deleteAccount);
router.patch('/me/role',  authenticate, ctrl.setRole);
router.get('/:id',   authenticate, ctrl.getUser);
router.patch('/:id/verification', authenticate, ctrl.setVerificationStatus);

module.exports = router;
