const bookingService = require('../services/bookingService');
const bookingModel = require('../models/bookingModel');
const { requireSpaceManagerOrAdmin } = require('../middleware/authorizationMiddleware');

/**
 * Create a new booking
 * POST /api/bookings
 */
const createBooking = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { spaceId, startTime, endTime, purpose } = req.body;

    const validation = bookingService.validateBookingRequest({
      spaceId,
      startTime,
      endTime,
      purpose,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: validation.errors.join(', '),
        },
      });
    }

    const booking = await bookingService.createBooking(userId, {
      spaceId,
      startTime,
      endTime,
      purpose,
    });

    res.status(201).json({
      success: true,
      data: {
        booking,
        confirmationNumber: booking.confirmationNumber,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'ERROR',
          message: error.message,
        },
      });
    }

    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Space is already booked at this time',
        },
      });
    }

    console.error('Error creating booking:', error);
    next(error);
  }
};

/**
 * Get user bookings
 * GET /api/bookings
 */
const getUserBookings = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { type, status, page, limit } = req.query;

    const filters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (page) filters.page = page;
    if (limit) filters.limit = limit;

    const result = await bookingService.getUserBookings(userId, filters);

    if (type === 'upcoming') {
      return res.status(200).json({
        success: true,
        data: {
          upcoming: result.upcoming,
          statistics: result.statistics,
          pagination: result.pagination,
        },
      });
    }

    if (type === 'past') {
      return res.status(200).json({
        success: true,
        data: {
          past: result.past,
          statistics: result.statistics,
          pagination: result.pagination,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error getting user bookings:', error);
    next(error);
  }
};

/**
 * Get booking by ID
 * GET /api/bookings/:id
 */
const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const booking = await bookingModel.findByIdWithSpace(parseInt(id));

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Booking not found',
        },
      });
    }

    if (booking.userId !== userId && userRole !== 'Administrator' && userRole !== 'Space_Manager') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to view this booking',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        booking,
      },
    });
  } catch (error) {
    console.error('Error getting booking by ID:', error);
    next(error);
  }
};

/**
 * Cancel booking
 * DELETE /api/bookings/:id
 */
const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const userRole = req.user.role;
    const { reason } = req.body;

    const booking = await bookingModel.findById(parseInt(id));

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Booking not found',
        },
      });
    }

    if (booking.userId !== userId && userRole !== 'Administrator' && userRole !== 'Space_Manager') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to cancel this booking',
        },
      });
    }

    let cancellationReason = reason || 'User_Requested';
    if (userRole === 'Administrator' || userRole === 'Space_Manager') {
      cancellationReason = reason || 'Administrative';
    }

    const cancelledBooking = await bookingService.cancelBooking(
      parseInt(id),
      userId,
      cancellationReason
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: cancelledBooking.bookingId,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelledAt,
        cancellationReason: cancelledBooking.cancellationReason,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          code: error.code || 'ERROR',
          message: error.message,
        },
      });
    }

    console.error('Error cancelling booking:', error);
    next(error);
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
};
