const express = require('express');
const router = express.Router();
const spaceController = require('../controllers/spaceController');




router.get('/', spaceController.getAllSpaces);


router.get('/:id', spaceController.getSpaceById);


module.exports = router;