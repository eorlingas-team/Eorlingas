const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, profileController.getProfile);
router.put('/', authenticate, profileController.updateProfile);
router.put('/password', authenticate, profileController.changePassword);
router.delete('/', authenticate, profileController.deleteAccount);

module.exports = router;

