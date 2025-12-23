const express = require('express');
const router = express.Router();
const spaceController = require('../controllers/spaceController');
const { optionalAuth } = require('../middleware/authMiddleware');

//  Tümünü listele (Landing Page)
router.get('/', optionalAuth, spaceController.getAllSpaces);

router.get('/search', optionalAuth, spaceController.searchSpaces);
router.get('/filters', spaceController.getFilterOptions);
router.get('/stats', spaceController.getStats);

router.get('/:id', spaceController.getSpaceById);

router.get('/:id/availability', spaceController.getSpaceAvailability);

//  Yeni ekle (Admin Dashboard)
router.post('/', spaceController.createSpace);

// Güncelle 
router.put('/:id', spaceController.updateSpace);

//  Sil (Admin Dashboard)
router.delete('/:id', spaceController.deleteSpace);

module.exports = router;