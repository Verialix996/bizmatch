const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { conversations, messages, send } = require('../controllers/message.controller');

router.get('/',                      authenticate, requireVerified, conversations);
router.get('/:matchId',              authenticate, requireVerified, messages);
router.post('/:matchId',             authenticate, requireVerified, send);

module.exports = router;
