const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin, requireStudent } = require('../middleware/authorizationMiddleware');

// Public routes (token-based authentication)
router.get('/defense/:token', reportController.getReportByToken);
router.post('/defense/:token', reportController.submitDefense);

// Student routes
router.post('/', authenticate, requireStudent, reportController.createReport);

// Admin routes
router.get('/pending-count', authenticate, requireAdmin, reportController.getPendingCount);
router.get('/', authenticate, requireAdmin, reportController.getAllReports);
router.get('/:id', authenticate, requireAdmin, reportController.getReportById);
router.put('/:id/reviewed', authenticate, requireAdmin, reportController.markAsReviewed);

module.exports = router;
