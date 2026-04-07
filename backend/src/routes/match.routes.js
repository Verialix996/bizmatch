const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { feed, swipe, matches } = require('../controllers/match.controller');

router.get('/feed',    authenticate, requireVerified, feed);
router.post('/swipe',  authenticate, requireVerified, swipe);
router.get('/matches', authenticate, requireVerified, matches);

module.exports = router;
