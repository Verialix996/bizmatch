const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { feed, swipe, matches, compatibility, getNdaStatus } = require('../controllers/match.controller');

router.get('/feed',                        authenticate, requireVerified, feed);
router.post('/swipe',                      authenticate, requireVerified, swipe);
router.get('/matches',                     authenticate, requireVerified, matches);
router.get('/compatibility/:targetUserId', authenticate, compatibility);
router.get('/nda-status',                  authenticate, getNdaStatus);

module.exports = router;
