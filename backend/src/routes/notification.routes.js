const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/notification.controller');

router.get('/',        authenticate, ctrl.getNotifications);
router.post('/read',   authenticate, ctrl.markRead);

module.exports = router;
