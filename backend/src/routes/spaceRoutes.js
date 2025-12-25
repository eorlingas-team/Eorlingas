const express = require('express');
const router = express.Router();
const spaceController = require('../controllers/spaceController');
const { optionalAuth, authenticate } = require('../middleware/authMiddleware');
const { requireSpaceManagerOrAdmin } = require('../middleware/authorizationMiddleware');

//  Tümünü listele (Landing Page)
router.get('/', optionalAuth, spaceController.getAllSpaces);

router.get('/search', optionalAuth, spaceController.searchSpaces);
router.get('/filters', spaceController.getFilterOptions);
router.get('/stats', spaceController.getStats);

router.get('/:id', spaceController.getSpaceById);

router.get('/:id/availability', spaceController.getSpaceAvailability);

//  Yeni ekle (Admin Dashboard)
router.post('/', authenticate, requireSpaceManagerOrAdmin, spaceController.createSpace);

// Güncelle 
router.put('/:id', authenticate, requireSpaceManagerOrAdmin, spaceController.updateSpace);

//  Sil (Admin Dashboard)
router.delete('/:id', authenticate, requireSpaceManagerOrAdmin, spaceController.deleteSpace);

module.exports = router;