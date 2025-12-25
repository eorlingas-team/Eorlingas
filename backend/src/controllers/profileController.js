const pool = require('../config/db');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');
const {
  validateProfileUpdate,
  validatePasswordChange,
} = require('../utils/validationSchemas');

/**
 * Get user profile
 * GET /api/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    let notificationPreferences = {
      emailNotifications: true,
      webNotifications: true,
    };

    if (user.notification_preferences) {
      try {
        notificationPreferences =
          typeof user.notification_preferences === 'string'
            ? JSON.parse(user.notification_preferences)
            : user.notification_preferences;
      } catch (error) {
        console.error('Error parsing notification preferences:', error);
      }
    }

    res.status(200).json({
      success: true,
      data: {
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
        notificationPreferences,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const validation = validateProfileUpdate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validation.errors,
        },
      });
    }

    const { fullName, phoneNumber, notificationPreferences } = req.body;
    const userId = req.user.userId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const updates = {};

    if (fullName !== undefined) {
      updates.full_name = fullName.trim();
    }

    if (phoneNumber !== undefined) {
      updates.phone_number = phoneNumber ? phoneNumber.trim() : null;
    }

    if (notificationPreferences !== undefined) {
      if (
        typeof notificationPreferences !== 'object' ||
        notificationPreferences === null
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'notificationPreferences must be an object',
          },
        });
      }

      const prefs = {
        emailNotifications:
          notificationPreferences.emailNotifications !== undefined
            ? Boolean(notificationPreferences.emailNotifications)
            : true,
        webNotifications:
          notificationPreferences.webNotifications !== undefined
            ? Boolean(notificationPreferences.webNotifications)
            : true,
      };

      updates.notification_preferences = JSON.stringify(prefs);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid fields to update',
        },
      });
    }

    const updatedUser = await userModel.update(userId, updates);

    let notificationPreferencesResponse = {
      emailNotifications: true,
      webNotifications: true,
    };

    if (updatedUser.notification_preferences) {
      try {
        notificationPreferencesResponse =
          typeof updatedUser.notification_preferences === 'string'
            ? JSON.parse(updatedUser.notification_preferences)
            : updatedUser.notification_preferences;
      } catch (error) {
        console.error('Error parsing notification preferences:', error);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        userId: updatedUser.user_id,
        email: updatedUser.email,
        fullName: updatedUser.full_name,
        studentNumber: updatedUser.student_number,
        phoneNumber: updatedUser.phone_number,
        role: updatedUser.role,
        status: updatedUser.status,
        emailVerified: updatedUser.email_verified,
        registrationDate: updatedUser.registration_date,
        lastLogin: updatedUser.last_login,
        notificationPreferences: notificationPreferencesResponse,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    next(error);
  }
};

/**
 * Change user password
 * PUT /api/profile/password
 */
const changePassword = async (req, res, next) => {
  try {
    const validation = validatePasswordChange(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: validation.errors,
        },
      });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Current password is incorrect',
        },
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await userModel.update(userId, {
      password_hash: passwordHash,
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    next(error);
  }
};

/**
 * Delete user account (self-deletion)
 * DELETE /api/profile
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    }

    // Check if user is the last administrator
    if (user.role === 'Administrator') {
      const adminCountResult = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'Administrator' AND status != 'Deleted'"
      );
      const adminCount = parseInt(adminCountResult.rows[0].count);
      
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'OPERATION_NOT_ALLOWED',
            message: 'Cannot delete the last administrator account.',
          },
        });
      }
    }

    // Cancel all active bookings
    await pool.query(
      `UPDATE bookings 
       SET status = 'Cancelled', 
           cancelled_at = NOW(),
           cancellation_reason = 'User_Requested'
       WHERE user_id = $1 AND status = 'Confirmed' AND start_time > NOW()`,
      [userId]
    );

    // Perform soft delete
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

    // Clear refresh token
    await userModel.clearRefreshToken(userId);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
};

