const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/project.controller');

router.get('/feed',                          authenticate, requireVerified, ctrl.feed);
router.get('/matches',                       authenticate, requireVerified, ctrl.matches);
router.post('/swipe',                        authenticate, requireVerified, ctrl.swipe);
router.get('/mine',                          authenticate, requireVerified, ctrl.mine);

// Partner invitation response (no :id project ambiguity — separate prefix)
router.post('/invitations/:id/respond',      authenticate, requireVerified, ctrl.respondInvitation);

router.get('/:id',                           authenticate, ctrl.getOne);
router.post('/',                             authenticate, requireVerified, ctrl.create);
router.put('/:id',                           authenticate, requireVerified, ctrl.update);
router.delete('/:id',                        authenticate, requireVerified, ctrl.remove);
router.patch('/:id/visibility',              authenticate, requireVerified, ctrl.setVisibility);
router.get('/:id/nda-status',               authenticate, requireVerified, ctrl.ndaStatus);
router.post('/:id/sign-nda',                authenticate, requireVerified, ctrl.ndaSign);
router.post('/:id/invite-partner',          authenticate, requireVerified, ctrl.invitePartner);
router.post('/:id/upload-deck',             authenticate, requireVerified, ...ctrl.uploadDeck);
router.post('/:id/upload-video',            authenticate, requireVerified, ...ctrl.uploadVideo);
router.get('/:id/partners',                 authenticate, ctrl.listPartners);
router.post('/:id/partners',               authenticate, requireVerified, ctrl.addPartner);
router.delete('/:id/partners/:userId',     authenticate, requireVerified, ctrl.removePartner);

module.exports = router;
