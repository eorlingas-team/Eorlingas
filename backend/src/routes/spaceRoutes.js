const express = require('express');
const router = express.Router();
const spaceController = require('../controllers/spaceController');

//  Tümünü listele (Landing Page)
router.get('/', spaceController.getAllSpaces);

router.get('/search', spaceController.searchSpaces);

router.get('/:id', spaceController.getSpaceById);

router.get('/:id/availability', spaceController.getSpaceAvailability);

//  Yeni ekle (Admin Dashboard)
router.post('/', spaceController.createSpace);

// Güncelle 
router.put('/:id', spaceController.updateSpace);

//  Sil (Admin Dashboard)
router.delete('/:id', spaceController.deleteSpace);

module.exports = router;