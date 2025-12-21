const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware'); 
const roleMiddleware = require('../middleware/authorizationMiddleware'); 

// --- SİSTEM & KULLANICI YÖNETİMİ (Sadece Administrator) ---

//  Sistem İstatistikleri
router.get(
  '/stats',
  authMiddleware.authenticate,      // Giriş yapmış mı?
  roleMiddleware.requireAdmin,      // Admin mi?
  adminController.getSystemStats    // İstatistikleri ver
);

// Tüm Kullanıcıları Listele
router.get(
  '/users',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.getAllUsers
);

//  Kullanıcı İşlemleri 
router.put(
  '/users/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireAdmin,
  adminController.updateUser
);



//  Tüm Mekanları Getir 
router.get(
  '/spaces',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin, 
  adminController.getAllSpacesAdmin
);

//  Yeni Mekan Oluştur
router.post(
  '/spaces',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.createSpace
);

//  Mekan Güncelle
router.put(
  '/spaces/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.updateSpace
);

//  Mekan Statüsü Değiştir 
router.put(
  '/spaces/:id/status',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.updateSpaceStatus
);

//  Mekan Sil 
router.delete(
  '/spaces/:id',
  authMiddleware.authenticate,
  roleMiddleware.requireSpaceManagerOrAdmin,
  adminController.deleteSpaceAdmin
);

module.exports = router;