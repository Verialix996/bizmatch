const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/project.controller');

router.get('/feed',           authenticate, requireVerified, ctrl.feed);
router.get('/matches',        authenticate, requireVerified, ctrl.matches);
router.post('/swipe',         authenticate, requireVerified, ctrl.swipe);
router.get('/mine',           authenticate, requireVerified, ctrl.mine);
router.get('/joined',         authenticate, requireVerified, ctrl.joined);
router.get('/owner/:userId',  authenticate, ctrl.byOwner);
router.get('/:id',            authenticate, ctrl.getOne);
router.post('/',                          authenticate, requireVerified, ctrl.create);
router.put('/:id',                        authenticate, requireVerified, ctrl.update);
router.delete('/:id',                     authenticate, requireVerified, ctrl.remove);
router.post('/:id/upload-deck',           authenticate, requireVerified, ...ctrl.uploadDeck);
router.post('/:id/upload-video',          authenticate, requireVerified, ...ctrl.uploadVideo);
router.get('/:id/partners',              authenticate, ctrl.listPartners);
router.post('/:id/partners',             authenticate, requireVerified, ctrl.addPartner);
router.delete('/:id/partners/:userId',   authenticate, requireVerified, ctrl.removePartner);
router.post('/:id/deck-review',          authenticate, requireVerified, ctrl.reviewDeck);
router.get('/:id/deck',                 ctrl.serveDeck);
router.get('/:id/nda',                  ctrl.serveNda);

module.exports = router;
