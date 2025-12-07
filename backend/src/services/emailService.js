/**
 * Email Service
 * Handles sending emails via Nodemailer (Gmail SMTP)
 */

require('dotenv').config();
const nodemailer = require('nodemailer');
const {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
} = require('../utils/emailTemplates');

/**
 * Create and configure email transporter
 * @returns {Object} Nodemailer transporter
 */
const createTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    return {
      sendMail: async (mailOptions) => {
        console.log('[TEST MODE] Email would be sent:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
        });
        return {
          messageId: 'test-message-id',
          accepted: [mailOptions.to],
          rejected: [],
        };
      },
    };
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Send email using transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @returns {Promise<Object>} Send result
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    if (process.env.NODE_ENV !== 'test') {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.error('Email configuration missing. EMAIL_USER and EMAIL_PASS must be set.');
        throw new Error('Email service not configured');
      }
    }

    const transporter = createTransporter();
    const from = process.env.EMAIL_FROM || `İTÜ Study Space Finder <${process.env.EMAIL_USER}>`;

    const mailOptions = {
      from: from,
      to: to,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', {
      to: to,
      subject: subject,
      messageId: info.messageId,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Error sending email:', error);
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

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};

