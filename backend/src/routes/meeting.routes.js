const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth');
const { propose, respond, list, briefing } = require('../controllers/meeting.controller');

router.use(authenticate, requireVerified);

router.post('/',           propose);
router.get('/',            list);
router.put('/:id',         respond);
router.get('/:id/briefing', briefing);

module.exports = router;
