const pool = require('../config/db');
const crypto = require('crypto');

/**
 * Generate a secure random token
 * @returns {string} Random token
 */
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Format report row from database to API format
 * @param {Object} row - Database row
 * @returns {Object} Formatted report object
 */
const formatReport = (row) => {
  return {
    reportId: row.report_id,
    bookingId: row.booking_id,
    reporterUserId: row.reporter_user_id,
    reportedUserId: row.reported_user_id,
    spaceId: row.space_id,
    message: row.message,
    status: row.status,
    defenseToken: row.defense_token,
    defenseMessage: row.defense_message,
    defenseSubmittedAt: row.defense_submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
  };
};

/**
 * Create new report
 * @param {Object} reportData
 * @returns {Object} Created report object with defense token
 */
const create = async (reportData) => {
  try {
    const {
      bookingId,
      reporterUserId,
      reportedUserId,
      spaceId,
      message,
    } = reportData;

    const defenseToken = generateToken();

    const result = await pool.query(
      `INSERT INTO booking_reports (
        booking_id, reporter_user_id, reported_user_id, space_id, message, defense_token
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [bookingId, reporterUserId, reportedUserId, spaceId, message, defenseToken]
    );

    return formatReport(result.rows[0]);
  } catch (error) {
    console.error('Error creating report:', error);
    throw error;
  }
};

/**
 * Find report by ID with full details
 * @param {number} reportId
 * @returns {Object|null} Report with user and booking details
 */
const findById = async (reportId) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.*,
        reporter.email as reporter_email, 
        reporter.full_name as reporter_full_name,
        reported.email as reported_email, 
        reported.full_name as reported_full_name,
        b.start_time, 
        b.end_time, 
        b.confirmation_number,
        s.space_name, 
        s.room_number,
        bu.building_name,
        c.campus_name
      FROM booking_reports r
      LEFT JOIN users reporter ON r.reporter_user_id = reporter.user_id
      LEFT JOIN users reported ON r.reported_user_id = reported.user_id
      LEFT JOIN bookings b ON r.booking_id = b.booking_id
      LEFT JOIN study_spaces s ON r.space_id = s.space_id
      LEFT JOIN buildings bu ON s.building_id = bu.building_id
      LEFT JOIN campuses c ON bu.campus_id = c.campus_id
      WHERE r.report_id = $1`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const report = formatReport(row);

    // Add related data
    report.reporter = {
      userId: row.reporter_user_id,
      email: row.reporter_email,
      fullName: row.reporter_full_name,
    };

    report.reportedUser = {
      userId: row.reported_user_id,
      email: row.reported_email,
      fullName: row.reported_full_name,
    };

    report.booking = {
      bookingId: row.booking_id,
      startTime: row.start_time,
      endTime: row.end_time,
      confirmationNumber: row.confirmation_number,
    };

    report.space = {
      spaceId: row.space_id,
      spaceName: row.space_name,
      roomNumber: row.room_number,
      buildingName: row.building_name,
      campusName: row.campus_name,
    };

    return report;
  } catch (error) {
    console.error('Error finding report by ID:', error);
    throw error;
  }
};

/**
 * Find all reports with optional filtering
 * @param {Object} filters - Optional filters (status)
 * @returns {Array} Array of report objects
 */
const findAll = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        r.*,
        reporter.email as reporter_email, 
        reporter.full_name as reporter_full_name,
        reported.email as reported_email, 
        reported.full_name as reported_full_name,
        b.start_time, 
        b.end_time, 
        b.confirmation_number,
        s.space_name, 
        s.room_number,
        bu.building_name,
        c.campus_name
      FROM booking_reports r
      LEFT JOIN users reporter ON r.reporter_user_id = reporter.user_id
      LEFT JOIN users reported ON r.reported_user_id = reported.user_id
      LEFT JOIN bookings b ON r.booking_id = b.booking_id
      LEFT JOIN study_spaces s ON r.space_id = s.space_id
      LEFT JOIN buildings bu ON s.building_id = bu.building_id
      LEFT JOIN campuses c ON bu.campus_id = c.campus_id
    `;

    const params = [];
    let paramIndex = 1;
    const conditions = [];

    if (filters.status && filters.status !== 'All') {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY r.created_at DESC`;

    const result = await pool.query(query, params);

    return result.rows.map((row) => {
      const report = formatReport(row);

      report.reporter = {
        userId: row.reporter_user_id,
        email: row.reporter_email,
        fullName: row.reporter_full_name,
      };

      report.reportedUser = {
        userId: row.reported_user_id,
        email: row.reported_email,
        fullName: row.reported_full_name,
      };

      report.booking = {
        bookingId: row.booking_id,
        startTime: row.start_time,
        endTime: row.end_time,
        confirmationNumber: row.confirmation_number,
      };

      report.space = {
        spaceId: row.space_id,
        spaceName: row.space_name,
        roomNumber: row.room_number,
        buildingName: row.building_name,
        campusName: row.campus_name,
      };

      return report;
    });
  } catch (error) {
    console.error('Error finding all reports:', error);
    throw error;
  }
};

/**
 * Find report by defense token
 * @param {string} token - Defense token
 * @returns {Object|null} Report object or null
 */
const findByDefenseToken = async (token) => {
  try {
    const result = await pool.query(
      `SELECT 
        r.*,
        b.start_time, 
        b.end_time, 
        b.confirmation_number,
        s.space_name, 
        s.room_number,
        bu.building_name,
        c.campus_name
      FROM booking_reports r
      LEFT JOIN bookings b ON r.booking_id = b.booking_id
      LEFT JOIN study_spaces s ON r.space_id = s.space_id
      LEFT JOIN buildings bu ON s.building_id = bu.building_id
      LEFT JOIN campuses c ON bu.campus_id = c.campus_id
      WHERE r.defense_token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const report = formatReport(row);

    report.booking = {
      bookingId: row.booking_id,
      startTime: row.start_time,
      endTime: row.end_time,
      confirmationNumber: row.confirmation_number,
    };

    report.space = {
      spaceId: row.space_id,
      spaceName: row.space_name,
      roomNumber: row.room_number,
      buildingName: row.building_name,
      campusName: row.campus_name,
    };

    return report;
  } catch (error) {
    console.error('Error finding report by defense token:', error);
    throw error;
  }
};

/**
 * Update defense message for a report
 * @param {number} reportId
 * @param {string} defenseMessage
 * @returns {Object} Updated report object
 */
const updateDefense = async (reportId, defenseMessage) => {
  try {
    const result = await pool.query(
      `UPDATE booking_reports 
       SET defense_message = $1, defense_submitted_at = CURRENT_TIMESTAMP
       WHERE report_id = $2
       RETURNING *`,
      [defenseMessage, reportId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return formatReport(result.rows[0]);
  } catch (error) {
    console.error('Error updating defense:', error);
    throw error;
  }
};

/**
 * Update report status (mark as reviewed)
 * @param {number} reportId
 * @param {string} status
 * @param {number} adminId
 * @param {string} notes - Optional admin notes
 * @returns {Object} Updated report object
 */
const updateStatus = async (reportId, status, adminId, notes = null) => {
  try {
    const result = await pool.query(
      `UPDATE booking_reports 
       SET status = $1, reviewed_by = $2, reviewed_at = CURRENT_TIMESTAMP, admin_notes = $3
       WHERE report_id = $4
       RETURNING *`,
      [status, adminId, notes, reportId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return formatReport(result.rows[0]);
  } catch (error) {
    console.error('Error updating report status:', error);
    throw error;
  }
};

/**
 * Count reports made by a user today
 * @param {number} userId - Reporter user ID
 * @returns {number} Count of reports today
 */
const countTodayByReporter = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM booking_reports 
       WHERE reporter_user_id = $1 
       AND DATE(created_at AT TIME ZONE 'Europe/Istanbul') = DATE(NOW() AT TIME ZONE 'Europe/Istanbul')`,
      [userId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error counting today reports:', error);
    throw error;
  }
};

/**
 * Count reports made by a user against a specific user this month
 * @param {number} reporterId - Reporter user ID
 * @param {number} reportedUserId - Reported user ID
 * @returns {number} Count of reports this month
 */
const countMonthlyAgainstUser = async (reporterId, reportedUserId) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM booking_reports 
       WHERE reporter_user_id = $1 
       AND reported_user_id = $2
       AND created_at >= DATE_TRUNC('month', NOW())`,
      [reporterId, reportedUserId]
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error counting monthly reports against user:', error);
    throw error;
  }
};

/**
 * Get statistics for a reported user
 * @param {number} userId - User ID
 * @returns {Object} User statistics
 */
const getReportedUserStats = async (userId) => {
  try {
    // Total bookings
    const bookingsResult = await pool.query(
      `SELECT COUNT(*) FROM bookings WHERE user_id = $1`,
      [userId]
    );

    // Total reports received
    const reportsResult = await pool.query(
      `SELECT COUNT(*) FROM booking_reports WHERE reported_user_id = $1`,
      [userId]
    );

    return {
      totalBookings: parseInt(bookingsResult.rows[0].count, 10),
      totalReportsReceived: parseInt(reportsResult.rows[0].count, 10),
    };
  } catch (error) {
    console.error('Error getting reported user stats:', error);
    throw error;
  }
};

/**
 * Count pending reports (for admin dashboard)
 * @returns {number} Count of pending reports
 */
const countPending = async () => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM booking_reports WHERE status = 'Pending'`
    );
    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error counting pending reports:', error);
    throw error;
  }
};

module.exports = {
  create,
  findById,
  findAll,
  findByDefenseToken,
  updateDefense,
  updateStatus,
  countTodayByReporter,
  countMonthlyAgainstUser,
  getReportedUserStats,
  countPending,
};
