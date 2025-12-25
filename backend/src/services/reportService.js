const reportModel = require('../models/reportModel');
const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');
const emailService = require('./emailService');

/**
 * Validate and create a new report
 * @param {number} reporterId - Reporter user ID
 * @param {Object} reportData - Report data
 * @returns {Object} Created report
 */
const createReport = async (reporterId, reportData) => {
  const { spaceId, reportTime, message } = reportData;

  // 1. Check daily report limit (max 3 per day)
  const todayCount = await reportModel.countTodayByReporter(reporterId);
  if (todayCount >= 3) {
    const error = new Error('Daily report limit reached (maximum 3 reports)');
    error.statusCode = 429;
    error.code = 'DAILY_LIMIT_EXCEEDED';
    throw error;
  }

  // 2. Find booking active at the specified report time
  const booking = await bookingModel.findActiveAtTime(spaceId, reportTime);
  
  if (!booking) {
    const error = new Error('No active booking found in this space at the reported time');
    error.statusCode = 404;
    error.code = 'NO_BOOKING_FOUND';
    throw error;
  }

  // 3. Check self-reporting
  if (booking.userId === reporterId) {
    const error = new Error('You cannot report your own booking');
    error.statusCode = 400;
    error.code = 'SELF_REPORT_NOT_ALLOWED';
    throw error;
  }

  // 4. Check monthly report limit against same user (max 3 per month)
  const monthlyCount = await reportModel.countMonthlyAgainstUser(reporterId, booking.userId);
  if (monthlyCount >= 3) {
    const error = new Error('Monthly report limit against this user reached');
    error.statusCode = 429;
    error.code = 'MONTHLY_USER_LIMIT_EXCEEDED';
    throw error;
  }

  // 5. Create the report
  const report = await reportModel.create({
    bookingId: booking.bookingId,
    reporterUserId: reporterId,
    reportedUserId: booking.userId,
    spaceId,
    message,
  });

  // 6. Send notification email to reported user
  try {
    if (booking.user && booking.user.email) {
      await emailService.sendReportNotificationEmail({
        to: booking.user.email,
        fullName: booking.user.fullName,
        booking,
        defenseToken: report.defenseToken,
      });
    }
  } catch (emailError) {
    console.error('Failed to send report notification email:', emailError);
    // Don't throw - report was created successfully
  }

  return report;
};

/**
 * Get all reports with optional filtering
 * @param {Object} filters - Optional filters
 * @returns {Array} Array of reports
 */
const getAllReports = async (filters = {}) => {
  return await reportModel.findAll(filters);
};

/**
 * Get a single report by ID
 * @param {number} reportId
 * @returns {Object|null} Report or null
 */
const getReportById = async (reportId) => {
  return await reportModel.findById(reportId);
};

/**
 * Submit defense for a report
 * @param {string} token - Defense token
 * @param {string} defenseMessage - Defense message
 * @returns {Object} Updated report
 */
const submitDefense = async (token, defenseMessage) => {
  const report = await reportModel.findByDefenseToken(token);

  if (!report) {
    const error = new Error('Invalid or expired defense link');
    error.statusCode = 404;
    error.code = 'INVALID_TOKEN';
    throw error;
  }

  if (report.defenseMessage) {
    const error = new Error('Defense already submitted for this report');
    error.statusCode = 400;
    error.code = 'DEFENSE_ALREADY_SUBMITTED';
    throw error;
  }

  return await reportModel.updateDefense(report.reportId, defenseMessage);
};

/**
 * Mark report as reviewed
 * @param {number} reportId
 * @param {number} adminId
 * @param {string} notes - Optional admin notes
 * @returns {Object} Updated report
 */
const markAsReviewed = async (reportId, adminId, notes = null) => {
  const report = await reportModel.findById(reportId);

  if (!report) {
    const error = new Error('Report not found');
    error.statusCode = 404;
    error.code = 'NOT_FOUND';
    throw error;
  }

  return await reportModel.updateStatus(reportId, 'Reviewed', adminId, notes);
};

/**
 * Get reported user statistics
 * @param {number} userId
 * @returns {Object} User statistics
 */
const getReportedUserStats = async (userId) => {
  return await reportModel.getReportedUserStats(userId);
};

/**
 * Get count of pending reports
 * @returns {number} Count
 */
const getPendingReportsCount = async () => {
  return await reportModel.countPending();
};

module.exports = {
  createReport,
  getAllReports,
  getReportById,
  submitDefense,
  markAsReviewed,
  getReportedUserStats,
  getPendingReportsCount,
};
