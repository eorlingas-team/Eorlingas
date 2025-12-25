/**
 * Email Service
 * Handles sending emails via SendGrid API
 */

require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const pool = require('../config/db');
const {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
  getBookingConfirmationTemplate,
  getBookingCancellationTemplate,
} = require('../utils/emailTemplates');

/**
 * Check if email sending is enabled
 * @returns {boolean}
 */
const isEmailEnabled = () => {
  return process.env.SEND_EMAILS === 'true';
};

/**
 * Initialize SendGrid API key
 */
const initializeSendGrid = () => {
  if (process.env.NODE_ENV !== 'test' && process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
};

// Initialize on module load
initializeSendGrid();

/**
 * Send email using SendGrid API
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async ({ to, subject, html }) => {
  // Check if email sending is enabled globally
  if (!isEmailEnabled()) {
    console.log('[EMAIL DISABLED] Email would be sent:', {
      to: to,
      subject: subject,
    });
    return {
      success: true,
      messageId: 'email-disabled-mock-id',
      disabled: true,
    };
  }

  // Check user notification preferences
  try {
    const userResult = await pool.query(
      'SELECT notification_preferences FROM users WHERE email = $1',
      [to.toLowerCase()]
    );
    
    if (userResult.rows.length > 0) {
      const prefs = userResult.rows[0].notification_preferences;
      if (prefs) {
        const parsedPrefs = typeof prefs === 'string' ? JSON.parse(prefs) : prefs;
        if (parsedPrefs.emailNotifications === false) {
          console.log(`[EMAIL BLOCKED] User ${to} has disabled email notifications.`);
          return {
            success: true,
            messageId: 'blocked-by-user-preferences',
            blocked: true,
          };
        }
      }
    }
  } catch (error) {
    console.error('Error checking user preferences in emailService:', error);
    // Continue with sending if preference check fails to be safe
  }

  // Test mode mock
  if (process.env.NODE_ENV === 'test') {
    console.log('[TEST MODE] Email would be sent:', {
      to: to,
      subject: subject,
    });
    return {
      success: true,
      messageId: 'test-message-id',
    };
  }

  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('Email configuration missing. SENDGRID_API_KEY must be set.');
      throw new Error('Email service not configured');
    }

    const from = process.env.EMAIL_FROM || 'İTÜ Study Space Finder <noreply@example.com>';

    const msg = {
      to: to,
      from: from,
      subject: subject,
      html: html,
    };

    const response = await sgMail.send(msg);
    
    console.log('Email sent successfully:', {
      to: to,
      subject: subject,
      messageId: response[0].headers['x-message-id'],
    });

    return {
      success: true,
      messageId: response[0].headers['x-message-id'],
    };
  } catch (error) {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('SendGrid error details:', error.response.body);
    }
    throw error;
  }
};

/**
 * Send verification email
 * @param {Object} data - Email data
 * @param {string} data.to - Recipient email address
 * @param {string} data.fullName - User's full name
 * @param {string} data.verificationToken - Verification token
 * @param {string} data.verificationCode - 6-digit verification code
 * @returns {Promise<Object>} Send result
 */
const sendVerificationEmail = async ({ to, fullName, verificationToken, verificationCode }) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const html = getVerificationEmailTemplate({
      fullName,
      verificationUrl,
      verificationCode,
    });

    return await sendEmail({
      to,
      subject: 'İTÜ Study Space Finder - Email Verification',
      html,
    });
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {Object} data - Email data
 * @param {string} data.to - Recipient email address
 * @param {string} data.fullName - User's full name
 * @param {string} data.resetToken - Password reset token
 * @returns {Promise<Object>} Send result
 */
const sendPasswordResetEmail = async ({ to, fullName, resetToken }) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const html = getPasswordResetEmailTemplate({
      fullName,
      resetUrl,
    });

    return await sendEmail({
      to,
      subject: 'İTÜ Study Space Finder - Password Reset',
      html,
    });
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Format date and time for email display
 * @param {Date|string} dateTime - Date/time to format
 * @returns {Object} { date: string, time: string }
 */
const formatDateTime = (dateTime) => {
  const date = new Date(dateTime);
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Istanbul'
  });
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Europe/Istanbul'
  });
  return { date: dateStr, time: timeStr };
};

/**
 * Send booking confirmation email
 * @param {Object} data - Email data
 * @param {string} data.to - Recipient email address
 * @param {string} data.fullName - User's full name
 * @param {Object} data.booking - Booking object with space details
 * @returns {Promise<Object>} Send result
 */
const sendBookingConfirmationEmail = async ({ to, fullName, booking }) => {
  try {
    const startDateTime = formatDateTime(booking.startTime);
    const endDateTime = formatDateTime(booking.endTime);

    const html = getBookingConfirmationTemplate({
      fullName,
      confirmationNumber: booking.confirmationNumber,
      spaceName: booking.space.spaceName,
      roomNumber: booking.space.roomNumber,
      buildingName: booking.space.building.buildingName,
      campusName: booking.space.building.campus.campusName,
      startTime: startDateTime.time,
      endTime: endDateTime.time,
      date: startDateTime.date,
      durationMinutes: booking.durationMinutes,
      purpose: booking.purpose,
    });

    return await sendEmail({
      to,
      subject: `Booking Confirmed - ${booking.confirmationNumber} - İTÜ Study Space Finder`,
      html,
    });
  } catch (error) {
    console.error('Error sending booking confirmation email:', error);
    throw error;
  }
};

/**
 * Send booking cancellation email
 * @param {Object} data - Email data
 * @param {string} data.to - Recipient email address
 * @param {string} data.fullName - User's full name
 * @param {Object} data.booking - Booking object with space details
 * @returns {Promise<Object>} Send result
 */
const sendBookingCancellationEmail = async ({ to, fullName, booking }) => {
  try {
    const startDateTime = formatDateTime(booking.startTime);
    const endDateTime = formatDateTime(booking.endTime);

    const html = getBookingCancellationTemplate({
      fullName,
      confirmationNumber: booking.confirmationNumber,
      spaceName: booking.space.spaceName,
      roomNumber: booking.space.roomNumber,
      startTime: startDateTime.time,
      endTime: endDateTime.time,
      date: startDateTime.date,
      cancellationReason: booking.cancellationReason || 'User_Requested',
    });

    return await sendEmail({
      to,
      subject: `Booking Cancelled - ${booking.confirmationNumber} - İTÜ Study Space Finder`,
      html,
    });
  } catch (error) {
    console.error('Error sending booking cancellation email:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  isEmailEnabled,
};
