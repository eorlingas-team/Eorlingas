const bcrypt = require('bcrypt');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getTokenExpirationTime,
} = require('../utils/jwtUtils');
const {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../utils/validationSchemas');
const pool = require('../config/db');
const {
  sendVerificationEmail: sendVerificationEmailService,
  sendPasswordResetEmail: sendPasswordResetEmailService,
} = require('../services/emailService');

/**
 * Generate a secure verification token (for database storage)
 * @returns {string} Verification token
 */
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a 6-digit verification code (for email display)
 * @returns {string} 6-digit verification code (100000-999999)
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send verification email to user
 * @param {string} to - Recipient email address
 * @param {string} token - Verification token (for URL)
 * @param {string} code - 6-digit verification code (for manual entry)
 * @param {string} fullName - User's full name
 */
const sendVerificationEmail = async (to, token, code, fullName) => {
  try {
    await sendVerificationEmailService({
      to,
      fullName,
      verificationToken: token,
      verificationCode: code,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
  }
};

/**
 * Send password reset email to user
 * @param {string} to - Recipient email address
 * @param {string} token - Password reset token
 * @param {string} fullName - User's full name
 */
const sendPasswordResetEmail = async (to, token, fullName) => {
  try {
    await sendPasswordResetEmailService({
      to,
      fullName,
      resetToken: token,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }
};

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const validation = validateRegistration(req.body);
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

    const { email, password, fullName, studentNumber, phoneNumber } = req.body;

    const existingUser = await userModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Email already registered',
        },
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await userModel.create({
      email,
      passwordHash,
      fullName,
      studentNumber,
      phoneNumber,
      role: 'Student',
      status: 'Unverified',
    });

    const verificationToken = generateVerificationToken();
    const verificationCode = generateVerificationCode();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    await userModel.setVerificationToken(user.user_id, verificationToken, verificationCode, tokenExpiry);

    await sendVerificationEmail(email, verificationToken, verificationCode, fullName);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Please check your email to verify your account.',
      data: {
        userId: user.user_id,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'Email or student number already registered',
        },
      });
    }

    next(error);
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const validation = validateLogin(req.body);
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

    const { email, password } = req.body;

    const user = await userModel.findByEmail(email);
    if (!user) {
      await logAuditEvent({
        actionType: 'Login_Failed',
        targetEntityType: 'User',
        ipAddress: req.ip || req.connection.remoteAddress,
        result: 'Failed',
        errorMessage: 'Invalid credentials',
      });

      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid email or password',
        },
      });
    }

    const failedAttempts = await userModel.getRecentFailedLoginAttempts(user.user_id);
    if (failedAttempts >= 5) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes or use password recovery.',
        },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await logAuditEvent({
        userId: user.user_id,
        actionType: 'Login_Failed',
        targetEntityType: 'User',
        targetEntityId: user.user_id,
        ipAddress: req.ip || req.connection.remoteAddress,
        result: 'Failed',
        errorMessage: 'Invalid password',
      });

      const newFailedAttempts = await userModel.getRecentFailedLoginAttempts(user.user_id);
      if (newFailedAttempts >= 5) {
        return res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: 'Account temporarily locked due to multiple failed login attempts. Please try again in 15 minutes or use password recovery.',
          },
        });
      }

      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid email or password',
        },
      });
    }

    if (user.status === 'Unverified') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Your email address has not been verified. Please check your email for the verification link.',
        },
      });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Account is suspended',
        },
      });
    }

    if (user.status === 'Deleted') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Account is deleted',
        },
      });
    }

    await userModel.updateLastLogin(user.user_id);
    
    const tokenPayload = {
      userId: user.user_id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    const expiresIn = getTokenExpirationTime();

    await userModel.setRefreshToken(user.user_id, refreshToken);

    await logAuditEvent({
      userId: user.user_id,
      actionType: 'Login_Success',
      targetEntityType: 'User',
      targetEntityId: user.user_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: {
        lastLogin: new Date().toISOString(),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn,
        user: {
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * Verify email address using verification token or code
 * POST /api/auth/verify-email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token, email, code } = req.body;

    let user = null;

    // Method 1: Token-based verification
    if (token) {
      user = await userModel.findByVerificationToken(token);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invalid or expired verification token',
          },
        });
      }
    }
    // Method 2: Code-based verification
    else if (code) {
      if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Verification code must be a 6-digit number',
          },
        });
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email is required for code-based verification',
          },
        });
      }

      user = await userModel.findByEmailAndCode(email, code);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invalid verification code',
          },
        });
      }
    }
    else {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Either token or code is required',
        },
      });
    }

    const now = new Date();
    const tokenExpiry = new Date(user.verification_token_expiry);

    if (now > tokenExpiry) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Verification token/code has expired. Please request a new one.',
        },
      });
    }

    if (user.email_verified && user.status === 'Verified') {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified',
      });
    }

    await userModel.update(user.user_id, {
      status: 'Verified',
      email_verified: true,
    });

    await userModel.clearVerificationToken(user.user_id);

    await logAuditEvent({
      userId: user.user_id,
      actionType: 'Status_Changed',
      targetEntityType: 'User',
      targetEntityId: user.user_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      beforeState: { status: 'Unverified', email_verified: false },
      afterState: { status: 'Verified', email_verified: true },
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    next(error);
  }
};

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email is required',
        },
      });
    }

    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a verification email has been sent.',
      });
    }

    if (user.email_verified && user.status === 'Verified') {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified',
      });
    }

    const verificationToken = generateVerificationToken();
    const verificationCode = generateVerificationCode();
    const tokenExpiry = new Date();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    await userModel.setVerificationToken(user.user_id, verificationToken, verificationCode, tokenExpiry);

    await sendVerificationEmail(email, verificationToken, verificationCode, user.full_name);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully.',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
        },
      });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Invalid or expired refresh token',
        },
      });
    }

    const user = await userModel.findById(decoded.userId);
    if (!user || user.status === 'Deleted' || user.status === 'Suspended') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or account inactive',
        },
      });
    }

    const isTokenValid = await userModel.isRefreshTokenValid(user.user_id, token);
    if (!isTokenValid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Refresh token has been invalidated. Please log in again.',
        },
      });
    }

    const tokenPayload = {
      userId: user.user_id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const expiresIn = getTokenExpirationTime();

    res.status(200).json({
      success: true,
      data: {
        token: accessToken,
        expiresIn: expiresIn,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    next(error);
  }
};

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
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
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    next(error);
  }
};

/**
 * Logout the current user
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { refreshToken } = req.body;

    await userModel.clearRefreshToken(userId);

    await logAuditEvent({
      userId: userId,
      actionType: 'Logout',
      targetEntityType: 'User',
      targetEntityId: userId,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: {
        action: 'logout',
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    next(error);
  }
};

/**
 * Request password reset
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const validation = validateForgotPassword(req.body);
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

    const { email } = req.body;

    const user = await userModel.findByEmail(email);
    
    if (user) {
      const resetToken = generateVerificationToken();
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + 24);

      await userModel.setPasswordResetToken(user.user_id, resetToken, tokenExpiry);

      await sendPasswordResetEmail(email, resetToken, user.full_name);

      await logAuditEvent({
        userId: user.user_id,
        actionType: 'Password_Reset',
        targetEntityType: 'User',
        targetEntityId: user.user_id,
        ipAddress: req.ip || req.connection.remoteAddress,
        result: 'Success',
        afterState: {
          action: 'password_reset_requested',
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(200).json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(200).json({
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.',
    });
  }
};

/**
 * Reset password using reset token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res, next) => {
  try {
    const validation = validateResetPassword(req.body);
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

    const { token, newPassword } = req.body;

    const user = await userModel.findByPasswordResetToken(token);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Invalid or expired reset token',
        },
      });
    }

    const now = new Date();
    const tokenExpiry = new Date(user.password_reset_token_expiry);

    if (now > tokenExpiry) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Reset token has expired. Please request a new one.',
        },
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    await userModel.update(user.user_id, {
      password_hash: passwordHash,
    });

    await userModel.clearPasswordResetToken(user.user_id);

    await logAuditEvent({
      userId: user.user_id,
      actionType: 'Password_Reset',
      targetEntityType: 'User',
      targetEntityId: user.user_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: {
        action: 'password_reset_completed',
        timestamp: new Date().toISOString(),
      },
    });

    try {
      await pool.query(
        `INSERT INTO notifications (
          user_id, notification_type, subject, message, status
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          user.user_id,
          'Password_Reset',
          'Password Reset Successful',
          'Your password has been successfully reset. If you did not request this, please contact support immediately.',
          'Pending',
        ]
      );
    } catch (notificationError) {
      console.error('Error creating password reset notification:', notificationError);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    next(error);
  }
};

/**
 * Helper function to log audit events
 * @param {Object} logData - Audit log data
 */
const logAuditEvent = async (logData) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (
        user_id, action_type, target_entity_type, target_entity_id,
        ip_address, before_state, after_state, result, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        logData.userId || null,
        logData.actionType,
        logData.targetEntityType,
        logData.targetEntityId || null,
        logData.ipAddress || null,
        logData.beforeState ? JSON.stringify(logData.beforeState) : null,
        logData.afterState ? JSON.stringify(logData.afterState) : null,
        logData.result || 'Success',
        logData.errorMessage || null,
      ]
    );
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  refreshToken,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
};
