const pool = require('../config/db');
const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');
const emailService = require('./emailService');
const { getIstanbulNow, getIstanbulHourMinute, ISTANBUL_TZ } = require('../utils/dateHelpers');
const { addDays } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

/**
 * Generate unique confirmation number
 * @returns {string} Confirmation number
 */
const generateConfirmationNumber = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generate unique confirmation number that doesn't exist in database
 * @returns {Promise<string>} Unique confirmation number
 */
const generateUniqueConfirmationNumber = async () => {
  let confirmationNumber;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 10;

  while (exists && attempts < maxAttempts) {
    confirmationNumber = generateConfirmationNumber();
    exists = await bookingModel.confirmationNumberExists(confirmationNumber);
    attempts++;
  }

  if (exists) {
    throw new Error('Failed to generate unique confirmation number');
  }

  return confirmationNumber;
};

/**
 * Get space details by ID
 * @param {number} spaceId
 * @returns {Object|null} Space object or null
 */
const getSpaceById = async (spaceId) => {
  try {
    const result = await pool.query(
      `SELECT s.*, 
              bu.building_name, 
              bu.operating_hours_weekday_start as building_weekday_start,
              bu.operating_hours_weekday_end as building_weekday_end,
              bu.operating_hours_weekend_start as building_weekend_start,
              bu.operating_hours_weekend_end as building_weekend_end,
              c.campus_name
       FROM study_spaces s
       INNER JOIN buildings bu ON s.building_id = bu.building_id
       INNER JOIN campuses c ON bu.campus_id = c.campus_id
       WHERE s.space_id = $1 AND s.status != 'Deleted'`,
      [spaceId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      spaceId: row.space_id,
      spaceName: row.space_name,
      roomNumber: row.room_number,
      floor: row.floor,
      capacity: row.capacity,
      roomType: row.room_type,
      noiseLevel: row.noise_level,
      description: row.description,
      amenities: row.amenities || [],
      accessibilityFeatures: row.accessibility_features || [],
      status: row.status,
      operatingHours: {
        weekday: {
          start: (row.operating_hours_weekday_start || row.building_weekday_start)?.slice(0, 5),
          end: (row.operating_hours_weekday_end || row.building_weekday_end)?.slice(0, 5),
        },
        weekend: {
          start: (row.operating_hours_weekend_start || row.building_weekend_start)?.slice(0, 5),
          end: (row.operating_hours_weekend_end || row.building_weekend_end)?.slice(0, 5),
        },
      },
      building: {
        buildingId: row.building_id,
        buildingName: row.building_name,
        campus: {
          campusId: row.campus_id,
          campusName: row.campus_name,
        },
      },
    };
  } catch (error) {
    console.error('Error getting space by ID:', error);
    throw error;
  }
};

/**
 * Check if booking time is within operating hours
 * @param {Object} space - Space object with operating hours
 * @param {Date} startTime - Booking start time
 * @param {Date} endTime - Booking end time
 * @returns {Object} { valid: boolean, message?: string }
 */
const checkOperatingHours = (space, startTime, endTime) => {
  const { hour: startHour, minute: startMinute } = getIstanbulHourMinute(startTime);
  const { hour: endHour, minute: endMinute } = getIstanbulHourMinute(endTime);
  
  // Get Istanbul day of week
  const dayOfWeek = toZonedTime(startTime, ISTANBUL_TZ).getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const operatingHours = isWeekend ? space.operatingHours.weekend : space.operatingHours.weekday;

  if (!operatingHours || !operatingHours.start || !operatingHours.end) {
    return { valid: false, message: 'Space operating hours not configured' };
  }

  const [opStartHour, opStartMin] = operatingHours.start.split(':').map(Number);
  const [opEndHour, opEndMin] = operatingHours.end.split(':').map(Number);

  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = endHour * 60 + endMinute;
  const opStartTotalMinutes = opStartHour * 60 + opStartMin;
  let opEndTotalMinutes = opEndHour * 60 + opEndMin;

  // Handle 23:59 as end of day (24:00)
  if (opEndHour === 23 && opEndMin === 59) {
    opEndTotalMinutes = 24 * 60;
  }

  if (startTotalMinutes < opStartTotalMinutes) {
    return { valid: false, message: `Booking must start after ${operatingHours.start}` };
  }

  if (endTotalMinutes > opEndTotalMinutes) {
    return { valid: false, message: `Booking must end before ${operatingHours.end}` };
  }

  return { valid: true };
};

/**
 * Validate booking request
 * @param {Object} bookingData - Booking data
 * @param {number} bookingData.spaceId
 * @param {Date} bookingData.startTime
 * @param {Date} bookingData.endTime
 * @param {string} [bookingData.purpose]
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
const validateBookingRequest = (bookingData) => {
  const errors = [];

  if (!bookingData.spaceId || typeof bookingData.spaceId !== 'number') {
    errors.push('Valid spaceId is required');
  }

  if (!bookingData.startTime) {
    errors.push('startTime is required');
  } else {
    const startTime = new Date(bookingData.startTime);
    if (isNaN(startTime.getTime())) {
      errors.push('Invalid startTime format');
    } else {
      if (startTime <= getIstanbulNow()) {
        errors.push('startTime must be in the future');
      }

      const maxDaysAhead = 14;
      const maxDate = addDays(getIstanbulNow(), maxDaysAhead);
      if (startTime > maxDate) {
        errors.push(`startTime must be within ${maxDaysAhead} days`);
      }
    }
  }

  if (!bookingData.endTime) {
    errors.push('endTime is required');
  } else {
    const endTime = new Date(bookingData.endTime);
    if (isNaN(endTime.getTime())) {
      errors.push('Invalid endTime format');
    } else {
      const startTime = new Date(bookingData.startTime);
      if (endTime <= startTime) {
        errors.push('endTime must be after startTime');
      }

      const durationMinutes = (endTime - startTime) / (1000 * 60);
      if (durationMinutes < 60) {
        errors.push('Booking duration must be at least 60 minutes');
      }
      if (durationMinutes > 180) {
        errors.push('Booking duration must be at most 180 minutes');
      }
    }
  }

  // Validate attendeeCount
  if (bookingData.attendeeCount !== undefined) {
    if (typeof bookingData.attendeeCount !== 'number' || bookingData.attendeeCount < 1 || !Number.isInteger(bookingData.attendeeCount)) {
      errors.push('attendeeCount must be a positive integer');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Check if user has exceeded booking limit
 * @param {number} userId
 * @param {number} maxConcurrentBookings - Maximum concurrent bookings (default: 5)
 * @returns {Promise<Object>} { allowed: boolean, currentCount: number, message?: string }
 */
const checkUserBookingLimit = async (userId, maxConcurrentBookings = 5) => {
  try {
    const currentCount = await bookingModel.countActiveBookings(userId);
    
    if (currentCount >= maxConcurrentBookings) {
      return {
        allowed: false,
        currentCount,
        message: `Maximum ${maxConcurrentBookings} concurrent bookings allowed`,
      };
    }

    return {
      allowed: true,
      currentCount,
    };
  } catch (error) {
    console.error('Error checking user booking limit:', error);
    throw error;
  }
};

/**
 * Create booking with all validations
 * @param {number} userId
 * @param {Object} bookingData
 * @param {number} bookingData.spaceId
 * @param {Date} bookingData.startTime
 * @param {Date} bookingData.endTime
 * @param {string} [bookingData.purpose]
 * @returns {Promise<Object>} Created booking with space details
 */
const createBooking = async (userId, bookingData) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const validation = validateBookingRequest(bookingData);
    if (!validation.valid) {
      await client.query('ROLLBACK');
      const error = new Error(validation.errors.join(', '));
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const startTime = new Date(bookingData.startTime);
    const endTime = new Date(bookingData.endTime);

    const space = await getSpaceById(bookingData.spaceId);
    if (!space) {
      await client.query('ROLLBACK');
      const error = new Error('Space not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }

    if (space.status !== 'Available') {
      await client.query('ROLLBACK');
      const error = new Error('Space is not available for booking');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    const operatingHoursCheck = checkOperatingHours(space, startTime, endTime);
    if (!operatingHoursCheck.valid) {
      await client.query('ROLLBACK');
      const error = new Error(operatingHoursCheck.message);
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const limitCheck = await checkUserBookingLimit(userId);
    if (!limitCheck.allowed) {
      await client.query('ROLLBACK');
      const error = new Error(limitCheck.message);
      error.statusCode = 403;
      error.code = 'FORBIDDEN';
      throw error;
    }

    const userOverlaps = await bookingModel.findUserOverlaps(userId, startTime, endTime, null, client);
    if (userOverlaps.length > 0) {
      await client.query('ROLLBACK');
      const error = new Error('You already have a booking at this time');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    const conflicts = await bookingModel.findConflicts(bookingData.spaceId, startTime, endTime, null, client);
    if (conflicts.length > 0) {
      await client.query('ROLLBACK');
      const error = new Error('Space is already booked at this time');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      throw error;
    }

    const confirmationNumber = await generateUniqueConfirmationNumber();

    const booking = await bookingModel.create(
      {
        userId,
        spaceId: bookingData.spaceId,
        startTime,
        endTime,
        confirmationNumber,
        attendeeCount: bookingData.attendeeCount || 1,
        purpose: bookingData.purpose || null,
      },
      client
    );

    await client.query('COMMIT');

    const bookingWithSpace = await bookingModel.findByIdWithSpace(booking.bookingId);

    try {
      const user = await userModel.findById(userId);
      if (user && user.email_verified) {
        const notificationPrefs = user.notification_preferences || { emailNotifications: true };
        if (notificationPrefs.emailNotifications !== false) {
          emailService.sendBookingConfirmationEmail({
            to: user.email,
            fullName: user.full_name,
            booking: bookingWithSpace,
          }).catch((err) => {
            console.error('Failed to send booking confirmation email:', err);
          });
        }
      }
    } catch (emailError) {
      console.error('Error sending booking confirmation email:', emailError);
    }

    return bookingWithSpace;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cancel booking
 * @param {number} bookingId
 * @param {number} userId - User ID (for authorization check)
 * @param {string} [cancellationReason] - Cancellation reason
 * @returns {Promise<Object>} Cancelled booking
 */
const cancelBooking = async (bookingId, userId, cancellationReason = 'User_Requested') => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const booking = await bookingModel.findById(bookingId);
    if (!booking) {
      await client.query('ROLLBACK');
      const error = new Error('Booking not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      throw error;
    }



    if (booking.status !== 'Confirmed') {
      await client.query('ROLLBACK');
      const error = new Error('Only confirmed bookings can be cancelled');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    const startTime = new Date(booking.startTime);
    const now = getIstanbulNow();

    if (startTime <= now) {
      await client.query('ROLLBACK');
      const error = new Error('Cannot cancel past bookings');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';
      throw error;
    }

    if (cancellationReason === 'User_Requested') {
      const gracePeriodMinutes = 15;
      const gracePeriod = new Date(startTime);
      gracePeriod.setMinutes(gracePeriod.getMinutes() - gracePeriodMinutes);

      if (now >= gracePeriod) {
        await client.query('ROLLBACK');
        const error = new Error(`Cannot cancel booking within ${gracePeriodMinutes} minutes of start time`);
        error.statusCode = 400;
        error.code = 'VALIDATION_ERROR';
        throw error;
      }
    }

    const cancelledBooking = await bookingModel.updateStatus(
      bookingId,
      'Cancelled',
      cancellationReason,
      client
    );

    await client.query('COMMIT');

    try {
      const bookingWithSpace = await bookingModel.findByIdWithSpace(bookingId);
      const user = await userModel.findById(booking.userId);
      if (user && user.email_verified && bookingWithSpace) {
        const notificationPrefs = user.notification_preferences || { emailNotifications: true };
        if (notificationPrefs.emailNotifications !== false) {
          emailService.sendBookingCancellationEmail({
            to: user.email,
            fullName: user.full_name,
            booking: bookingWithSpace,
          }).catch((err) => {
            console.error('Failed to send booking cancellation email:', err);
          });
        }
      }
    } catch (emailError) {
      console.error('Error sending booking cancellation email:', emailError);
    }

    return cancelledBooking;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get user bookings with categorization (upcoming/past)
 * @param {number} userId
 * @param {Object} filters - Optional filters (type, status, page, limit)
 * @returns {Promise<Object>} { upcoming: Array, past: Array, statistics: Object, pagination: Object }
 */
const getUserBookings = async (userId, filters = {}) => {
  try {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 20;
    const offset = (page - 1) * limit;

    const upcomingFilters = { ...filters, type: 'upcoming', limit, offset };
    const upcoming = await bookingModel.findByUserIdWithSpace(userId, upcomingFilters);
    const upcomingCount = await bookingModel.countByUserId(userId, { type: 'upcoming' });

    const pastFilters = { ...filters, type: 'past', limit, offset };
    const past = await bookingModel.findByUserIdWithSpace(userId, pastFilters);
    const pastCount = await bookingModel.countByUserId(userId, { type: 'past' });

    const cancelledFilters = { ...filters, type: 'cancelled', limit, offset };
    const cancelled = await bookingModel.findByUserIdWithSpace(userId, cancelledFilters);
    const cancelledCount = await bookingModel.countByUserId(userId, { type: 'cancelled' });

    const totalCount = await bookingModel.countByUserId(userId);

    return {
      upcoming,
      past,
      cancelled,
      statistics: {
        totalBookings: totalCount,
        upcomingCount,
        pastCount,
        cancelledCount,
      },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  } catch (error) {
    console.error('Error getting user bookings:', error);
    throw error;
  }
};

module.exports = {
  createBooking,
  cancelBooking,
  getUserBookings,
  validateBookingRequest,
  checkUserBookingLimit,
  checkOperatingHours,
  getSpaceById,
};
