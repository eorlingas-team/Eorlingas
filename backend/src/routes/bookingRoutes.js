const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/authorizationMiddleware');
const { validateBookingRequest, validateBookingCancellation } = require('../utils/validationSchemas');

/**
 * Validation middleware for booking creation
 */
const validateBookingCreation = (req, res, next) => {
  const validation = validateBookingRequest(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.errors.join(', '),
      },
    });
  }
  next();
};

/**
 * Validation middleware for booking cancellation
 */
const validateCancellation = (req, res, next) => {
  const validation = validateBookingCancellation(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: validation.errors.join(', '),
      },
    });
  }
  next();
};


router.post(
  '/',
  authenticate,
  requireStudent,
  validateBookingCreation,
  bookingController.createBooking
);

router.get('/', authenticate, bookingController.getUserBookings);

router.get('/:id', authenticate, bookingController.getBookingById);

router.delete(
  '/:id',
  authenticate,
  validateCancellation,
  bookingController.cancelBooking
);

module.exports = router;
