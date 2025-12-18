const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');


const authMiddleware = require('../middleware/authMiddleware'); 
const roleMiddleware = require('../middleware/authorizationMiddleware'); 

// Sistem İstatistikleri ( Administrator)
router.get(
  '/stats',
  authMiddleware.authenticate,      // Giriş yapmış mı?
  roleMiddleware.requireAdmin,     // Admin mi?
  adminController.getSystemStats   // İstatistikleri ver
);

//  Tüm Kullanıcıları Listele ( Administrator)
router.get(
  '/users',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.getAllUsers
);

//   Banlama/Rol Değişme ( Administrator)
router.put(
  '/users/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.updateUser
);

module.exports = router;