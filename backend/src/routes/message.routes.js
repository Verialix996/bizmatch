const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const {
  conversations, messages, send,
  sendInvite, respondToInvite,
  requestNda, signNda,
} = require('../controllers/message.controller');

router.get('/',                                              authenticate, requireVerified, conversations);
router.get('/:matchId',                                      authenticate, requireVerified, messages);
router.post('/:matchId',                                     authenticate, requireVerified, send);
router.post('/:matchId/invite',                              authenticate, requireVerified, sendInvite);
router.post('/:matchId/invite/:invitationId/respond',        authenticate, requireVerified, respondToInvite);
router.post('/:matchId/nda-request',                         authenticate, requireVerified, requestNda);
router.post('/:matchId/nda-sign',                            authenticate, requireVerified, signNda);

module.exports = router;
