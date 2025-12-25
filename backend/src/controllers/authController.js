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
const escapeHtml = require('escape-html');
const {
  sendVerificationEmail: sendVerificationEmailService,
  sendPasswordResetEmail: sendPasswordResetEmailService,
  sendAccountRecoveryEmail: sendAccountRecoveryEmailService,
} = require('../services/emailService');
const notificationService = require('../services/notificationService');
const logAuditEvent = require('../utils/auditLogger');
const { getIstanbulNow } = require('../utils/dateHelpers');
const { formatInTimeZone } = require('date-fns-tz');

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
    // Sanitize fullName to prevent XSS in email
    const safeFullName = escapeHtml(fullName || '');
    
    await sendVerificationEmailService({
      to,
      fullName: safeFullName,
      verificationToken: token,
      verificationCode: code,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
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
    // Sanitize fullName to prevent XSS in email
    const safeFullName = escapeHtml(fullName || '');

    await sendPasswordResetEmailService({
      to,
      fullName: safeFullName,
      resetToken: token,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
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
    const tokenExpiry = getIstanbulNow();
    tokenExpiry.setHours(tokenExpiry.getHours() + 24);

    await userModel.setVerificationToken(user.user_id, verificationToken, verificationCode, tokenExpiry);

    // Try to send verification email, but don't block registration if it fails
    try {
      await sendVerificationEmail(email, verificationToken, verificationCode, fullName);
    } catch (emailError) {
      console.error('Failed to send verification email, but registration will continue:', emailError.message);
      // In test mode (SEND_EMAILS !== 'true'), users can verify with code 123456
    }

    await logAuditEvent({
      userId: user.user_id,
      actionType: 'User_Registered',
      targetEntityType: 'User',
      targetEntityId: user.user_id,
      ipAddress: req.ip || req.connection.remoteAddress,
      result: 'Success',
      afterState: {
        userId: user.user_id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });

    // Adjust message based on email status
    const emailEnabled = process.env.SEND_EMAILS === 'true';
    const message = emailEnabled
      ? 'Registration successful! Please check your email to verify your account.'
      : 'Registration successful! Use verification code 123456 to verify your account.';

    res.status(201).json({
      success: true,
      message: message,
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
        beforeState: { attemptedEmail: email }
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
        beforeState: { attemptedEmail: email }
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
      // Check if suspension has expired
      if (user.suspended_until) {
        const now = new Date();
        const suspendedUntil = new Date(user.suspended_until);
        
        if (now > suspendedUntil) {
          // Suspension expired - auto restore
          await userModel.update(user.user_id, {
            status: 'Verified',
            suspended_until: null
          });
          
          // Send in-app notification
          notificationService.createNotification(user.user_id, 'Account_Recovery', {
            subject: 'Account Restored',
            message: 'Your suspension period has ended. Your account has been automatically restored. You can now make new bookings.'
          }).catch((err) => {
            console.error('Failed to send auto-recovery notification:', err);
          });

          // Send email notification
          if (user.email) {
            sendAccountRecoveryEmailService({
              to: user.email,
              fullName: user.full_name
            }).catch((err) => {
              console.error('Failed to send auto-recovery email:', err);
            });
          }

          // Continue with login - user is now restored
          console.log(`User ${user.email} auto-restored from suspension`);
          user.status = 'Verified'; // Update local object for the rest of login logic
        } else {
             console.log(`Suspended user ${user.email} logged in. Suspension until: ${suspendedUntil}`);
        }
      } else {
          console.log(`Permanently suspended user ${user.email} logged in.`);
      }
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
        lastLogin: formatInTimeZone(getIstanbulNow(), 'Europe/Istanbul', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      },
    });

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
        token: accessToken,
        refreshToken: refreshToken,
        expiresIn: expiresIn,
        user: {
          userId: user.user_id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          status: user.status,
          studentNumber: user.student_number || user.studentNumber,
          createdAt: user.created_at,
          phoneNumber: user.phone_number,
          notificationPreferences
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
      if (!code || typeof code !== 'string' || code.length !== 6 || !/^\d{6}$/.test(code)) {
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

      // TEST MODE: Allow 123456 as universal verification code when emails are disabled
      if (code === '123456' && process.env.SEND_EMAILS !== 'true') {
        user = await userModel.findByEmail(email);
        if (!user) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'User not found',
            },
          });
        }
        console.log('[TEST MODE] Verification bypass with code 123456 for:', email);
      } else {
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

    const now = getIstanbulNow();
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
    const tokenExpiry = getIstanbulNow();
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
        notificationPreferences
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
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
      const tokenExpiry = getIstanbulNow();
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
          timestamp: formatInTimeZone(getIstanbulNow(), 'Europe/Istanbul', "yyyy-MM-dd'T'HH:mm:ssXXX"),
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

    const now = getIstanbulNow();
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
        timestamp: formatInTimeZone(getIstanbulNow(), 'Europe/Istanbul', "yyyy-MM-dd'T'HH:mm:ssXXX"),
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
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    // If the user is authenticated (middleware attached user to req), log the event
    if (req.user && req.user.userId) {
      await userModel.setRefreshToken(req.user.userId, null); // Invalidate refresh token
      
      await logAuditEvent({
        userId: req.user.userId,
        actionType: 'Logout',
        targetEntityType: 'User',
        targetEntityId: req.user.userId,
        ipAddress: req.ip || req.connection.remoteAddress,
        result: 'Success',
        afterState: {
          logoutTime: formatInTimeZone(getIstanbulNow(), 'Europe/Istanbul', "yyyy-MM-dd'T'HH:mm:ssXXX"),
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    next(error);
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
