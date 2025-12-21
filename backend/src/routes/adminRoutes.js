const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

const authMiddleware = require('../middleware/authMiddleware'); 
const roleMiddleware = require('../middleware/authorizationMiddleware'); 




router.get(
  '/stats',
  authMiddleware.authenticate,      
  roleMiddleware.requireAdmin,      
  adminController.getSystemStats   
);


router.get(
  '/users',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.getAllUsers
);


router.put(
  '/users/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.updateUser
);



router.get(
  '/spaces',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin, 
  adminController.getAllSpacesAdmin
);

router.post(
  '/spaces',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.createSpace
);


router.put(
  '/spaces/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.updateSpace
);


router.put(
  '/spaces/:id/status',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.updateSpaceStatus
);


router.delete(
  '/spaces/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.deleteSpaceAdmin
);



router.get(
  '/audit-logs',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.getAuditLogs
);


router.post(
  '/audit-logs/export',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.exportAuditLogs
);

module.exports = router;