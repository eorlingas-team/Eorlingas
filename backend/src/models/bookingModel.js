const pool = require('../config/db');

/**
 * Format booking row from database to API format
 * @param {Object} row - Database row
 * @returns {Object} Formatted booking object
 */
const formatBooking = (row) => {
  return {
    bookingId: row.booking_id,
    userId: row.user_id,
    spaceId: row.space_id,
    startTime: row.start_time,
    endTime: row.end_time,
    durationMinutes: row.duration_minutes,
    purpose: row.purpose,
    status: row.status,
    confirmationNumber: row.confirmation_number,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
  };
};

/**
 * Find booking by ID
 * @param {number} bookingId
 * @returns {Object|null} Booking object or null
 */
const findById = async (bookingId) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [bookingId]
    );
    return result.rows.length > 0 ? formatBooking(result.rows[0]) : null;
  } catch (error) {
    console.error('Error finding booking by ID:', error);
    throw error;
  }
};

/**
 * Find bookings by user ID with optional filters
 * @param {number} userId
 * @param {Object} filters - Optional filters
 * @returns {Array} Array of booking objects
 */
const findByUserId = async (userId, filters = {}) => {
  try {
    let query = 'SELECT * FROM bookings WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (filters.type === 'upcoming') {
      query += ` AND start_time > NOW() AND status = 'Confirmed'`;
    } else if (filters.type === 'past') {
      query += ` AND (start_time <= NOW() OR status IN ('Cancelled', 'Completed', 'No_Show'))`;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    query += ' ORDER BY start_time DESC';

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }

    const result = await pool.query(query, params);
    return result.rows.map(formatBooking);
  } catch (error) {
    console.error('Error finding bookings by user ID:', error);
    throw error;
  }
};

/**
 * Count bookings by user ID with filters
 * @param {number} userId
 * @param {Object} filters - Optional filters
 * @returns {number} Count of bookings
 */
const countByUserId = async (userId, filters = {}) => {
  try {
    let query = 'SELECT COUNT(*) FROM bookings WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (filters.type === 'upcoming') {
      query += ` AND start_time > NOW() AND status = 'Confirmed'`;
    } else if (filters.type === 'past') {
      query += ` AND (start_time <= NOW() OR status IN ('Cancelled', 'Completed', 'No_Show'))`;
    }

    if (filters.status) {
      query += ` AND status = $${paramIndex}`;
      params.push(filters.status);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error counting bookings by user ID:', error);
    throw error;
  }
};

/**
 * Find conflicting bookings for a space and time range
 * Uses row-level locking to prevent double bookings
 * @param {number} spaceId
 * @param {Date} startTime
 * @param {Date} endTime
 * @param {number} [excludeBookingId] - Booking ID to exclude from conflict check
 * @param {Object} [transaction] - Database transaction client
 * @returns {Array} Array of conflicting bookings
 */
const findConflicts = async (spaceId, startTime, endTime, excludeBookingId = null, transaction = null) => {
  try {
    let query = `
      SELECT * FROM bookings
      WHERE space_id = $1
        AND status = 'Confirmed'
        AND (
          (start_time < $3 AND end_time > $2)
        )
    `;
    const params = [spaceId, startTime, endTime];

    if (excludeBookingId) {
      query += ` AND booking_id != $4`;
      params.push(excludeBookingId);
    }


    query += ' FOR UPDATE';

    const client = transaction || pool;
    const result = await client.query(query, params);
    return result.rows.map(formatBooking);
  } catch (error) {
    console.error('Error finding booking conflicts:', error);
    throw error;
  }
};

/**
 * Find overlapping bookings for a user
 * @param {number} userId
 * @param {Date} startTime
 * @param {Date} endTime
 * @param {number} [excludeBookingId] - Booking ID to exclude
 * @param {Object} [transaction] - Database transaction client
 * @returns {Array} Array of overlapping bookings
 */
const findUserOverlaps = async (userId, startTime, endTime, excludeBookingId = null, transaction = null) => {
  try {
    let query = `
      SELECT * FROM bookings
      WHERE user_id = $1
        AND status = 'Confirmed'
        AND (
          (start_time < $3 AND end_time > $2)
        )
    `;
    const params = [userId, startTime, endTime];

    if (excludeBookingId) {
      query += ` AND booking_id != $4`;
      params.push(excludeBookingId);
    }

    const client = transaction || pool;
    const result = await client.query(query, params);
    return result.rows.map(formatBooking);
  } catch (error) {
    console.error('Error finding user booking overlaps:', error);
    throw error;
  }
};

/**
 * Count active future bookings for a user
 * @param {number} userId
 * @returns {number} Count of active bookings
 */
const countActiveBookings = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM bookings
       WHERE user_id = $1
         AND status = 'Confirmed'
         AND start_time > NOW()`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error counting active bookings:', error);
    throw error;
  }
};

/**
 * Create new booking
 * @param {Object} bookingData
 * @param {number} bookingData.userId
 * @param {number} bookingData.spaceId
 * @param {Date} bookingData.startTime
 * @param {Date} bookingData.endTime
 * @param {string} bookingData.confirmationNumber
 * @param {string} [bookingData.purpose]
 * @param {Object} [transaction] - Database transaction client
 * @returns {Object} Created booking object
 */
const create = async (bookingData, transaction = null) => {
  try {
    const {
      userId,
      spaceId,
      startTime,
      endTime,
      confirmationNumber,
      purpose = null,
    } = bookingData;

    const client = transaction || pool;
    const result = await client.query(
      `INSERT INTO bookings (
        user_id, space_id, start_time, end_time, confirmation_number, purpose, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Confirmed')
      RETURNING *`,
      [userId, spaceId, startTime, endTime, confirmationNumber, purpose]
    );

    return formatBooking(result.rows[0]);
  } catch (error) {
    console.error('Error creating booking:', error);
    throw error;
  }
};

/**
 * Update booking status
 * @param {number} bookingId
 * @param {string} status 
 * @param {string} [cancellationReason] - Cancellation reason if cancelling
 * @param {Object} [transaction] - Database transaction client
 * @returns {Object} Updated booking object
 */
const updateStatus = async (bookingId, status, cancellationReason = null, transaction = null) => {
  try {
    const client = transaction || pool;
    let query = `
      UPDATE bookings
      SET status = $1, updated_at = CURRENT_TIMESTAMP
    `;
    const params = [status, bookingId];

    if (status === 'Cancelled') {
      query += `, cancelled_at = CURRENT_TIMESTAMP`;
      if (cancellationReason) {
        query += `, cancellation_reason = $3`;
        params.splice(1, 0, cancellationReason);
      }
    }

    query += ` WHERE booking_id = $${params.length} RETURNING *`;

    const result = await client.query(query, params);
    
    if (result.rows.length === 0) {
      return null;
    }

    return formatBooking(result.rows[0]);
  } catch (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }
};

/**
 * Check if confirmation number exists
 * @param {string} confirmationNumber
 * @returns {boolean} True if exists
 */
const confirmationNumberExists = async (confirmationNumber) => {
  try {
    const result = await pool.query(
      'SELECT 1 FROM bookings WHERE confirmation_number = $1',
      [confirmationNumber]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking confirmation number:', error);
    throw error;
  }
};

/**
 * Get booking with space details
 * @param {number} bookingId
 * @returns {Object|null} Booking with space details or null
 */
const findByIdWithSpace = async (bookingId) => {
  try {
    const result = await pool.query(
      `SELECT 
        b.*,
        s.space_name, s.room_number, s.floor, s.capacity,
        s.room_type, s.noise_level, s.description,
        s.amenities, s.accessibility_features,
        s.operating_hours_weekday_start, s.operating_hours_weekday_end,
        s.operating_hours_weekend_start, s.operating_hours_weekend_end,
        bu.building_id, bu.building_name,
        c.campus_id, c.campus_name
      FROM bookings b
      INNER JOIN study_spaces s ON b.space_id = s.space_id
      INNER JOIN buildings bu ON s.building_id = bu.building_id
      INNER JOIN campuses c ON bu.campus_id = c.campus_id
      WHERE b.booking_id = $1`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const booking = formatBooking(row);

    booking.space = {
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
      operatingHours: {
        weekday: {
          start: row.operating_hours_weekday_start?.slice(0, 5),
          end: row.operating_hours_weekday_end?.slice(0, 5),
        },
        weekend: {
          start: row.operating_hours_weekend_start?.slice(0, 5),
          end: row.operating_hours_weekend_end?.slice(0, 5),
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

    return booking;
  } catch (error) {
    console.error('Error finding booking with space:', error);
    throw error;
  }
};

module.exports = {
  findById,
  findByUserId,
  countByUserId,
  findConflicts,
  findUserOverlaps,
  countActiveBookings,
  create,
  updateStatus,
  confirmationNumberExists,
  findByIdWithSpace,
};
