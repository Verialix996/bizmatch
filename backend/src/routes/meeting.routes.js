const router = require('express').Router();
const { authenticate, requireVerified } = require('../middleware/auth.middleware');
const { propose, respond, list, reschedule } = require('../controllers/meeting.controller');

router.use(authenticate, requireVerified);

router.post('/',                propose);
router.get('/',                 list);
router.put('/:id',              respond);
router.patch('/:id/reschedule', reschedule);

module.exports = router;
