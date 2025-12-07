/**
 * Email Templates
 * Professional HTML email templates for İTÜ Study Space Finder
 */

/**
 * Base email template wrapper
 * @param {string} content - Main content HTML
 * @param {string} title - Email title
 * @returns {string} Complete HTML email
 */
const getBaseTemplate = (content, title) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      line-height: 1.6;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 40px 20px;
      text-align: center;
      color: #ffffff;
    }
    .email-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }
    .email-body {
      padding: 40px 30px;
      color: #333333;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 30px 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: #3b82f6;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 20px 0;
      transition: background-color 0.3s;
    }
    .button:hover {
      background-color: #2563eb;
    }
    .code-box {
      background-color: #f3f4f6;
      border: 2px dashed #d1d5db;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .code-box .code {
      font-size: 32px;
      font-weight: 700;
      color: #1e3a8a;
      letter-spacing: 8px;
      font-family: 'Courier New', monospace;
    }
    .divider {
      height: 1px;
      background-color: #e5e7eb;
      margin: 30px 0;
    }
    .info-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning-box {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer-link {
      color: #3b82f6;
      text-decoration: none;
    }
    .footer-link:hover {
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .email-body {
        padding: 30px 20px;
      }
      .email-header {
        padding: 30px 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>İTÜ Study Space Finder</h1>
    </div>
    <div class="email-body">
      ${content}
    </div>
    <div class="email-footer">
      <p style="margin: 0 0 10px 0;">
        <strong>İTÜ Study Space Finder</strong>
      </p>
      <p style="margin: 0 0 10px 0; font-size: 12px;">
        This email was automatically sent by the İstanbul Technical University Study Space Finder system.
      </p>
      <p style="margin: 0; font-size: 12px;">
        For questions: <a href="mailto:itustudyspacefinder@gmail.com" class="footer-link">itustudyspacefinder@gmail.com</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Email verification template
 * @param {Object} data - Email data
 * @param {string} data.fullName - User's full name
 * @param {string} data.verificationUrl - Verification URL
 * @param {string} data.verificationCode - 6-digit verification code
 * @returns {string} HTML email
 */
const getVerificationEmailTemplate = ({ fullName, verificationUrl, verificationCode }) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1e3a8a;">Email Verification</h2>
    
    <p>Hello <strong>${fullName}</strong>,</p>
    
    <p>Welcome to İTÜ Study Space Finder! To activate your account, please verify your email address.</p>
    
    <div class="code-box">
      <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">Your Verification Code:</p>
      <div class="code">${verificationCode}</div>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">Enter this code on the verification page</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <p style="margin: 0 0 15px 0; color: #6b7280;">or</p>
      <a href="${verificationUrl}" class="button">Verify Email</a>
    </div>
    
    <div class="info-box">
      <p style="margin: 0; font-size: 14px;">
        <strong>Note:</strong> This verification code is valid for 24 hours.
      </p>
    </div>
    
    <div class="divider"></div>
  `;
  
  return getBaseTemplate(content, 'Email Verification - İTÜ Study Space Finder');
};

/**
 * Password reset email template
 * @param {Object} data - Email data
 * @param {string} data.fullName - User's full name
 * @param {string} data.resetUrl - Password reset URL
 * @returns {string} HTML email
 */
const getPasswordResetEmailTemplate = ({ fullName, resetUrl }) => {
  const content = `
    <h2 style="margin: 0 0 20px 0; color: #1e3a8a;">Password Reset</h2>
    
    <p>Hello <strong>${fullName}</strong>,</p>
    
    <p>We received a password reset request for your account. Click the button below to set a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <div class="warning-box">
      <p style="margin: 0; font-size: 14px;">
        <strong>Security Warning:</strong> If you did not request this password reset, you can safely ignore this email. Your account will remain secure.
      </p>
    </div>
    
    <div class="info-box">
      <p style="margin: 0; font-size: 14px;">
        <strong>Note:</strong> This link is valid for 24 hours. If it expires, you will need to create a new password reset request.
      </p>
    </div>
    
    <div class="divider"></div>

  `;
  
  return getBaseTemplate(content, 'Password Reset - İTÜ Study Space Finder');
};

module.exports = {
  getVerificationEmailTemplate,
  getPasswordResetEmailTemplate,
};

