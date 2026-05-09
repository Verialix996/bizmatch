const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth');
const { propose, respond, list, briefing, reschedule } = require('../controllers/meeting.controller');

router.use(authenticate, requireVerified);

router.post('/',                propose);
router.get('/',                 list);
router.put('/:id',              respond);
router.patch('/:id/reschedule', reschedule);
router.get('/:id/briefing',     briefing);

module.exports = router;
