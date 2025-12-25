const express = require('express');
const router = express.Router();
const cronController = require('../controllers/cronController');

// Route: /api/cron/reminders?secret=...
router.all('/reminders', cronController.sendReminders);

module.exports = router;
