const reportService = require('../services/reportService');
const reportModel = require('../models/reportModel');
const logAuditEvent = require('../utils/auditLogger');

/**
 * Create a new report
 * POST /api/reports
 */
const createReport = async (req, res, next) => {
  try {
    const reporterId = req.user.userId;
    const { spaceId, reportTime, message } = req.body;

    // Validate required fields
    if (!spaceId || !reportTime || !message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'spaceId, reportTime, and message are required',
        },
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Message must be at least 10 characters long',
        },
      });
    }

    const report = await reportService.createReport(reporterId, {
      spaceId,
      reportTime: new Date(reportTime),
      message,
    });

    res.status(201).json({
      success: true,
      message: 'Your report has been submitted successfully',
      data: {
        reportId: report.reportId,
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
    console.error('Error creating report:', error);
    next(error);
  }
};

/**
 * Get all reports (Admin only)
 * GET /api/reports
 */
const getAllReports = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filters = {};
    
    if (status && status !== 'All') {
      filters.status = status;
    }

    const reports = await reportService.getAllReports(filters);
    const pendingCount = await reportModel.countPending();

    res.status(200).json({
      success: true,
      data: {
        reports,
        pendingCount,
      },
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    next(error);
  }
};

/**
 * Get report by ID (Admin only)
 * GET /api/reports/:id
 */
const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const report = await reportService.getReportById(parseInt(id));

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Report not found',
        },
      });
    }

    // Get reported user statistics
    const userStats = await reportService.getReportedUserStats(report.reportedUserId);

    res.status(200).json({
      success: true,
      data: {
        report,
        reportedUserStats: userStats,
      },
    });
  } catch (error) {
    console.error('Error getting report by ID:', error);
    next(error);
  }
};

/**
 * Mark report as reviewed (Admin only)
 * PUT /api/reports/:id/reviewed
 */
const markAsReviewed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    const { notes } = req.body;

    const report = await reportService.markAsReviewed(parseInt(id), adminId, notes);

    res.status(200).json({
      success: true,
      message: 'Report marked as reviewed',
      data: {
        report,
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
    console.error('Error marking report as reviewed:', error);
    next(error);
  }
};

/**
 * Submit defense for a report (Public - token based)
 * POST /api/reports/defense/:token
 */
const submitDefense = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { defenseMessage } = req.body;

    if (!defenseMessage || defenseMessage.length < 10) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Defense message must be at least 10 characters long',
        },
      });
    }

    const report = await reportService.submitDefense(token, defenseMessage);

    res.status(200).json({
      success: true,
      message: 'Your defense has been submitted successfully',
      data: {
        reportId: report.reportId,
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
    console.error('Error submitting defense:', error);
    next(error);
  }
};

/**
 * Get report by defense token (Public - for defense page)
 * GET /api/reports/defense/:token
 */
const getReportByToken = async (req, res, next) => {
  try {
    const { token } = req.params;
    const report = await reportModel.findByDefenseToken(token);

    if (!report) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired defense link',
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        report: {
          reportId: report.reportId,
          booking: report.booking,
          space: report.space,
          defenseMessage: report.defenseMessage,
          defenseSubmittedAt: report.defenseSubmittedAt,
          createdAt: report.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Error getting report by token:', error);
    next(error);
  }
};

/**
 * Get pending reports count (Admin only)
 * GET /api/reports/pending-count
 */
const getPendingCount = async (req, res, next) => {
  try {
    const count = await reportModel.countPending();
    
    res.status(200).json({
      success: true,
      data: {
        pendingCount: count,
      },
    });
  } catch (error) {
    console.error('Error getting pending count:', error);
    next(error);
  }
};

module.exports = {
  createReport,
  getAllReports,
  getReportById,
  markAsReviewed,
  submitDefense,
  getReportByToken,
  getPendingCount,
};
