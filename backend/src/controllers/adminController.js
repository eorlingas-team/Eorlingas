const db = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const validationSchemas = require('../utils/validationSchemas');
const { getIstanbulNow } = require('../utils/dateHelpers');
const { formatInTimeZone } = require('date-fns-tz');
const emailService = require('../services/emailService');

// --- Helper Functions ---

/**
 * Log audit event helper
 */
const logAuditEvent = async (data) => {
  const { userId, actionType, targetEntityType, targetEntityId, ipAddress, result, beforeState, afterState, errorMessage } = data;
  const query = `
      INSERT INTO audit_logs (
          user_id, action_type, target_entity_type, target_entity_id,
          ip_address, result, before_state, after_state, error_message, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
  `;
  const values = [
      userId, actionType, targetEntityType, targetEntityId,
      ipAddress, result, beforeState, afterState, errorMessage
  ];
  try {
      await db.query(query, values);
  } catch (err) {
      console.error('Audit Log Error:', err);
  }
};

/**
 * Get system-wide statistics for admin dashboard
 * GET /api/admin/stats
 */
const getSystemStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    console.log("Admin Stats Request Params:", { startDate, endDate });

    // Construct SQL date clauses using parameterized queries
    let bookingDateClause = "";
    let userDateClause = "1=1"; // Default always true
    const queryParams = [];
    
    if (startDate && endDate) {
        bookingDateClause = `AND start_time >= $1 AND start_time < ($2::date + interval '1 day')`;
        userDateClause = `registration_date >= $1 AND registration_date < ($2::date + interval '1 day')`;
        queryParams.push(startDate, endDate);
    } else {
        // Provide dummy parameters if missing to avoid SQL errors
        userDateClause = "1=1";
    }

    const [
      userStats, 
      spaceStats, 
      bookingStats,
      bookingBreakdownResult,
      peakHoursResult,
      mostBookedResult
    ] = await Promise.all([
      // User statistics
      db.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN status = 'Verified' THEN 1 END) as active_users,
          COUNT(CASE WHEN ${userDateClause} THEN 1 END) as new_users_period
        FROM users
        WHERE status != 'Deleted'
      `, queryParams),
      
      // Space statistics
      db.query(`
        SELECT 
          COUNT(*) as total_spaces,
          COUNT(CASE WHEN status = 'Available' THEN 1 END) as available_spaces
        FROM study_spaces
        WHERE status != 'Deleted'
      `),
      
      // Booking statistics
      db.query(`
        SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'Confirmed' AND start_time > NOW() THEN 1 END) as active_bookings_snapshot,
          COUNT(CASE WHEN status = 'Confirmed' THEN 1 END) as confirmed_bookings,
          COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled_bookings
        FROM bookings
        WHERE 1=1 ${bookingDateClause}
      `, queryParams),

      // Breakdown: Booking Status
      db.query(`
        SELECT
          COUNT(CASE WHEN status = 'Completed' OR (status = 'Confirmed' AND start_time <= NOW()) THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'Confirmed' AND start_time > NOW() THEN 1 END) as upcoming,
          COUNT(CASE WHEN status = 'Cancelled' THEN 1 END) as cancelled
        FROM bookings
        WHERE 1=1 ${bookingDateClause}
      `, queryParams),

      // Peak Usage Hours
      db.query(`
        SELECT 
          EXTRACT(HOUR FROM start_time) as hour,
          COUNT(*) as booking_count
        FROM bookings
        WHERE 1=1 ${bookingDateClause}
        GROUP BY hour
        ORDER BY hour ASC
      `, queryParams),

      // Most Booked Spaces
      db.query(`
        SELECT 
          s.space_name,
          b.building_name,
          COUNT(bk.booking_id) as booking_count
        FROM bookings bk
        JOIN study_spaces s ON bk.space_id = s.space_id
        JOIN buildings b ON s.building_id = b.building_id
        WHERE 1=1 ${bookingDateClause}
        GROUP BY s.space_id, s.space_name, b.building_name
        ORDER BY booking_count DESC
        LIMIT 5
      `, queryParams)
    ]);

    const users = userStats.rows[0];
    const spaces = spaceStats.rows[0];
    const bookings = bookingStats.rows[0];
    const breakdown = bookingBreakdownResult.rows[0];
    
    // Process Peak Hours into full 24h array
    const peakHoursMap = new Map();
    peakHoursResult.rows.forEach(row => {
        peakHoursMap.set(parseInt(row.hour), parseInt(row.booking_count));
    });
    
    const peakHoursData = [];
    for (let i = 0; i < 24; i++) {
        peakHoursData.push({
            hour: i,
            count: peakHoursMap.get(i) || 0
        });
    }

    // Process Most Booked
    const mostBooked = mostBookedResult.rows.map(row => ({
        name: row.space_name,
        location: row.building_name,
        bookings: parseInt(row.booking_count)
    }));

    // Calculate generic stats
    const dbTotalBookings = parseInt(bookings.total_bookings) || 0;
    const cancelledBookings = parseInt(bookings.cancelled_bookings) || 0;
    
    // Calculate cancellation rate based on all bookings in period
    const cancellationRate = dbTotalBookings > 0 
        ? ((cancelledBookings / dbTotalBookings) * 100).toFixed(1) 
        : 0;

    // Breakdown Data Processing
    const completedCount = parseInt(breakdown.completed) || 0;
    const upcomingCount = parseInt(breakdown.upcoming) || 0;
    const cancelledCount = parseInt(breakdown.cancelled) || 0;
    // User requested breakdown total to be sum of these three
    const breakdownTotal = completedCount + upcomingCount + cancelledCount;

    res.json({
      success: true,
      data: {
        statistics: {
          // Cards
          activeUsers: parseInt(users.active_users) || 0,
          totalSpaces: parseInt(spaces.total_spaces) || 0,
          // Total Bookings card matches breakdown total (Completed + Upcoming + Cancelled)
          totalBookings: breakdownTotal,
          cancellationRate: parseFloat(cancellationRate),
          
          // Breakdown
          breakdown: {
            completed: completedCount,
            upcoming: upcomingCount,
            cancelled: cancelledCount,
            total: breakdownTotal
          },

          // Charts
          peakBookingHours: peakHoursData,
          mostBookedSpaces: mostBooked,
          
          // Additional Info mainly for cards logic
          availableSpaces: parseInt(spaces.available_spaces) || 0
        }
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve system statistics'
      }
    });
  }
};

/**
 * Get all users with filtering
 * GET /api/admin/users
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Apply filters
    if (role) {
      whereConditions.push(`u.role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }

    // Status Filter
    if (status === 'Deleted') {
      whereConditions.push("u.status = 'Deleted'");
    } else if (!status || status === 'All') {
      whereConditions.push("u.status IN ('Verified', 'Suspended', 'Unverified')");
    } else {
      whereConditions.push(`u.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM users u WHERE ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users with booking count
    queryParams.push(limit, offset);
    const usersResult = await db.query(
      `SELECT 
        u.user_id,
        u.email,
        u.full_name,
        u.student_number,
        u.phone_number,
        u.role,
        u.status,
        u.email_verified,
        u.registration_date,
        u.last_login,
        u.updated_at,
        COUNT(b.booking_id) as booking_count
      FROM users u
      LEFT JOIN bookings b ON u.user_id = b.user_id
      WHERE ${whereClause}
      GROUP BY u.user_id
      ORDER BY u.registration_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    const users = usersResult.rows.map(user => ({
      userId: user.user_id,
      email: user.email,
      fullName: user.full_name,
      studentNumber: user.student_number,
      phoneNumber: user.phone_number,
      role: user.role,
      status: user.status,
      emailVerified: user.email_verified,
      registrationDate: user.registration_date,
      lastLogin: user.last_login,
      updatedAt: user.updated_at,
      bookingCount: parseInt(user.booking_count) || 0
    }));

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve users'
      }
    });
  }
};

/**
 * Update user (admin actions)
 * PUT /api/admin/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { action, params } = req.body;

    // Validate user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    let updatedUser;

    switch (action) {
      case 'changeRole':
        if (!params?.role || !['Student', 'Space_Manager', 'Administrator'].includes(params.role)) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid role specified'
            }
          });
        }
        updatedUser = await userModel.update(userId, { role: params.role });
        
        await logAuditEvent({
          userId: req.user?.userId || null,
          actionType: 'Role_Changed',
          targetEntityType: 'User',
          targetEntityId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
          result: 'Success',
          beforeState: { role: user.role },
          afterState: { role: params.role }
        });
        break;

      case 'suspend':
        // Cancel all active bookings
        await db.query(
          `UPDATE bookings 
           SET status = 'Cancelled', 
               cancelled_at = NOW(),
               cancellation_reason = 'Administrative'
           WHERE user_id = $1 AND status = 'Confirmed' AND start_time > NOW()`,
          [userId]
        );
        
        // Set 1 week suspension
        const suspendedUntil = new Date();
        suspendedUntil.setDate(suspendedUntil.getDate() + 7);
        
        updatedUser = await userModel.update(userId, { 
          status: 'Suspended',
          suspended_until: suspendedUntil
        });
        
        // Send suspension email notification
        if (user.email) {
            await emailService.sendAccountSuspensionEmail({
                to: user.email,
                fullName: user.full_name,
                suspendedUntil: suspendedUntil,
                reason: 'Administrative Action'
            });
        }
        
        await logAuditEvent({
          userId: req.user?.userId || null,
          actionType: 'Account_Suspended',
          targetEntityType: 'User',
          targetEntityId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
          result: 'Success',
          beforeState: { status: user.status },
          afterState: { status: 'Suspended', suspendedUntil: suspendedUntil }
        });
        break;

      case 'restore':
        updatedUser = await userModel.update(userId, { 
          status: 'Verified',
          suspended_until: null
        });

        await logAuditEvent({
          userId: req.user?.userId || null,
          actionType: 'Status_Changed',
          targetEntityType: 'User',
          targetEntityId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
          result: 'Success',
          beforeState: { status: user.status },
          afterState: { status: 'Verified' }
        });
        break;

      case 'resetPassword':
        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await db.query(
          'UPDATE users SET password_hash = $1 WHERE user_id = $2',
          [hashedPassword, userId]
        );
        
        updatedUser = await userModel.findById(userId);

        await logAuditEvent({
          userId: req.user?.userId || null,
          actionType: 'Password_Reset',
          targetEntityType: 'User',
          targetEntityId: userId,
          ipAddress: req.ip || req.connection.remoteAddress,
          result: 'Success',
          afterState: { action: 'admin_reset_password', timestamp: formatInTimeZone(getIstanbulNow(), 'Europe/Istanbul', "yyyy-MM-dd'T'HH:mm:ssXXX") }
        });

        return res.json({
          success: true,
          message: 'Password reset successfully',
          data: {
            user: {
              userId: updatedUser.user_id,
              email: updatedUser.email,
              fullName: updatedUser.full_name,
              role: updatedUser.role,
              status: updatedUser.status
            },
            temporaryPassword: tempPassword
          }
        });

      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid action specified'
          }
        });
    }

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          userId: updatedUser.user_id,
          email: updatedUser.email,
          fullName: updatedUser.full_name,
          studentNumber: updatedUser.student_number,
          phoneNumber: updatedUser.phone_number,
          role: updatedUser.role,
          status: updatedUser.status,
          emailVerified: updatedUser.email_verified,
          registrationDate: updatedUser.registration_date,
          lastLogin: updatedUser.last_login
        }
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update user'
      }
    });
  }
};

/**
 * Delete user (soft delete)
 * DELETE /api/admin/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Validate user exists
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    // Check if user is the last administrator
    if (user.role === 'Administrator') {
      const adminCountResult = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'Administrator' AND status != 'Deleted'"
      );
      const adminCount = parseInt(adminCountResult.rows[0].count);
      
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OPERATION_NOT_ALLOWED',
            message: 'Cannot delete the last administrator account.'
          }
        });
      }
    }

    // Cancel all active bookings
    await db.query(
      `UPDATE bookings 
       SET status = 'Cancelled', 
           cancelled_at = NOW(),
           cancellation_reason = 'Administrative'
       WHERE user_id = $1 AND status = 'Confirmed' AND start_time > NOW()`,
      [userId]
    );

    // Perform soft delete with anonymization to free up email/studentNumber for re-registration
    const timestamp = Date.now();
    const updates = { 
      status: 'Deleted'
    };

    if (user.email) {
        const [localPart, domain] = user.email.split('@');
        updates.email = `${localPart}_deleted_${timestamp}@${domain || 'itu.edu.tr'}`;
    }
    if (user.student_number) {
        updates.student_number = `${user.student_number}_deleted_${timestamp}`;
    }

    await userModel.update(userId, updates);

    await logAuditEvent({
      userId: req.user?.userId || null,
      actionType: 'Status_Changed',
      targetEntityType: 'User',
      targetEntityId: userId,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      beforeState: { 
          status: user.status,
          email: user.email,
          studentNumber: user.student_number
      },
      afterState: { 
          status: 'Deleted',
          email: updates.email,
          studentNumber: updates.studentNumber
      }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete user'
      }
    });
  }
};

/**
 * Create user (Admin Action)
 * POST /api/admin/users
 */
const createUser = async (req, res) => {
  try {
    const { email, password, fullName, role, studentNumber, phoneNumber } = req.body;

    // Basic field check
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields'
        }
      });
    }

    // Advanced Validation
    if (!validationSchemas.isValidGenericEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid email format'
        }
      });
    }

    const pwValidation = validationSchemas.validatePassword(password);
    if (!pwValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: pwValidation.message
        }
      });
    }

    if (phoneNumber && !validationSchemas.isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid phone number format'
        }
      });
    }

    // Check conflict
    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Email already exists'
        }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (
        email, password_hash, full_name, student_number, phone_number, role, status, email_verified, registration_date
      ) VALUES ($1, $2, $3, $4, $5, $6, 'Verified', true, NOW())
      RETURNING *`,
      [email, hashedPassword, fullName, studentNumber || null, phoneNumber || null, role]
    );

    const newUser = result.rows[0];

    await logAuditEvent({
      userId: req.user?.userId || null,
      actionType: 'User_Registered',
      targetEntityType: 'User',
      targetEntityId: newUser.user_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: {
        userId: newUser.user_id,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        status: newUser.status,
        createdBy: 'Admin',
        createdById: req.user?.userId || null
      }
    });

    // Response structure matching other endpoints
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          userId: newUser.user_id,
          email: newUser.email,
          fullName: newUser.full_name,
          role: newUser.role,
          status: newUser.status,
          studentNumber: newUser.student_number
        }
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create user'
      }
    });
  }
};



// --- AUDIT LOGS (DENETİM KAYITLARI) ---

/**
 * Get audit logs with filtering
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      actionType,
      userId,
      targetEntityType,
      result,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    // Apply filters
    if (dateFrom) {
      whereConditions.push(`al.timestamp >= $${paramIndex}`);
      queryParams.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      whereConditions.push(`al.timestamp < ($${paramIndex}::date + interval '1 day')`);
      queryParams.push(dateTo);
      paramIndex++;
    }

    if (actionType) {
      whereConditions.push(`al.action_type = $${paramIndex}`);
      queryParams.push(actionType);
      paramIndex++;
    }

    if (userId) {
      whereConditions.push(`al.user_id = $${paramIndex}`);
      queryParams.push(parseInt(userId));
      paramIndex++;
    }

    if (targetEntityType) {
      whereConditions.push(`al.target_entity_type = $${paramIndex}`);
      queryParams.push(targetEntityType);
      paramIndex++;
    }

    if (result) {
      whereConditions.push(`al.result = $${paramIndex}`);
      queryParams.push(result);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].total);

    // Get logs
    queryParams.push(limit, offset);
    const logsResult = await db.query(
      `SELECT 
        al.log_id,
        al.user_id,
        al.action_type,
        al.target_entity_type,
        al.target_entity_id,
        al.ip_address,
        al.before_state,
        al.after_state,
        al.result,
        al.error_message,
        al.timestamp,
        u.email as user_email,
        u.full_name as user_name,
        target_u.email as target_email,
        target_u.full_name as target_full_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      LEFT JOIN users target_u ON al.target_entity_type = 'User' AND al.target_entity_id = target_u.user_id
      ${whereClause}
      ORDER BY al.timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      queryParams
    );

    const logs = logsResult.rows.map(log => ({
      logId: log.log_id,
      userId: log.user_id,
      user: log.user_id ? {
        email: log.user_email,
        fullName: log.user_name
      } : null,
      targetUser: (log.target_entity_type === 'User' && log.target_email) ? {
          email: log.target_email,
          fullName: log.target_full_name
      } : null,
      actionType: log.action_type,
      targetEntityType: log.target_entity_type,
      targetEntityId: log.target_entity_id,
      ipAddress: log.ip_address,
      beforeState: log.before_state,
      afterState: log.after_state,
      result: log.result,
      errorMessage: log.error_message,
      timestamp: log.timestamp
    }));

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve audit logs'
      }
    });
  }
};

//  Audit Logları Dışa Aktar 
const exportAuditLogs = async (req, res) => {
  try {
    const { format = 'json', filters = {} } = req.body; 
    const { dateFrom, dateTo, actionType, userId } = filters;

    let queryText = `
      SELECT a.log_id, a.action_type, a.user_id, u.email, a.target_entity_type, 
             a.target_entity_id, a.result, a.timestamp, a.ip_address 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    
    if (dateFrom) { queryText += ` AND a.timestamp >= $${paramIndex}`; queryParams.push(dateFrom); paramIndex++; }
    if (dateTo) { queryText += ` AND a.timestamp < ($${paramIndex}::date + interval '1 day')`; queryParams.push(dateTo); paramIndex++; }
    if (actionType) { queryText += ` AND a.action_type = $${paramIndex}`; queryParams.push(actionType); paramIndex++; }
    if (userId) { queryText += ` AND a.user_id = $${paramIndex}`; queryParams.push(userId); paramIndex++; }

    queryText += ` ORDER BY a.timestamp DESC LIMIT 1000`; // Güvenlik için max 1000 

    const dbResult = await db.query(queryText, queryParams);
    const logs = dbResult.rows;

    if (format.toLowerCase() === 'csv') {
     
      const fields = ['log_id', 'action_type', 'email', 'target_entity_type', 'result', 'timestamp', 'ip_address'];
      const header = fields.join(',');
      const rows = logs.map(row => {
        return fields.map(field => {
          const val = row[field] ? String(row[field]).replace(/,/g, ';') : ''; 
          return val;
        }).join(',');
      });
      
      const csvContent = [header, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      return res.status(200).send(csvContent);
    } else {
     
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
      return res.status(200).json(logs);
    }

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Export başarısız.' } });
  }
};

module.exports = {
  getSystemStats,
  getAllUsers,
  updateUser,
  deleteUser,
  createUser,
  getAuditLogs,
  exportAuditLogs
};