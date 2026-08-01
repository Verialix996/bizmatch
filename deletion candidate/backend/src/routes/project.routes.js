const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/project.controller');

router.get('/mine',                       authenticate, requireVerified, ctrl.mine);
router.get('/:id',                        authenticate, ctrl.getOne);
router.post('/',                          authenticate, requireVerified, ctrl.create);
router.put('/:id',                        authenticate, requireVerified, ctrl.update);
router.delete('/:id',                     authenticate, requireVerified, ctrl.remove);
router.post('/:id/upload-deck',           authenticate, requireVerified, ...ctrl.uploadDeck);
router.post('/:id/upload-video',          authenticate, requireVerified, ...ctrl.uploadVideo);
router.post('/:id/deck-review',           authenticate, requireVerified, ctrl.reviewDeck);
router.get('/:id/deck',                   ctrl.serveDeck);

module.exports = router;
