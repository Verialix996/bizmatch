const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { conversations, messages, send, markRead, shareProject } = require('../controllers/message.controller');

router.get('/',                    authenticate, requireVerified, conversations);
router.get('/:matchId',            authenticate, requireVerified, messages);
router.post('/:matchId',           authenticate, requireVerified, send);
router.post('/:matchId/read',      authenticate, requireVerified, markRead);
router.post('/:matchId/share-project', authenticate, requireVerified, shareProject);

module.exports = router;
