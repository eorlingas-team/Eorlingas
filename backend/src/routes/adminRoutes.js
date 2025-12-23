const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/authorizationMiddleware');

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// System statistics
router.get('/stats', adminController.getSystemStats);

// User management
router.get('/users', adminController.getAllUsers);
router.put('/users/:id', adminController.updateUser);
router.post('/users', adminController.createUser);
router.delete('/users/:id', adminController.deleteUser);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);
router.post('/audit-logs/export', adminController.exportAuditLogs);

module.exports = router;
