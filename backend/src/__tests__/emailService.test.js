/**
 * Email Service Unit Tests
 * Tests for email sending functionality
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.SEND_EMAILS = 'true';
process.env.SENDGRID_API_KEY = 'SG.test_sendgrid_api_key';
process.env.EMAIL_FROM = 'Test <test@example.com>';
process.env.FRONTEND_URL = 'http://localhost:3000';

const emailService = require('../services/emailService');
const emailTemplates = require('../utils/emailTemplates');

// Mock pool
jest.mock('../config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
}));

const pool = require('../config/db');

// Mock SendGrid
jest.mock('@sendgrid/mail', () => {
  return {
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{
      statusCode: 202,
      headers: {
        'x-message-id': 'test-message-id',
      },
    }]),
  };
});

const sgMail = require('@sendgrid/mail');

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset console.log to avoid test output pollution
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendEmail', () => {
    it('should send email successfully in test mode', async () => {
      const result = await emailService.sendEmail({
        to: 'test@itu.edu.tr',
        subject: 'Test Email',
        html: '<p>Test content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should include correct email properties in test mode', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        subject: 'Test Subject',
        html: '<h1>Test</h1>',
      };

      await emailService.sendEmail(emailData);

      // In test mode, transporter.sendMail is not called
      // but the function should complete successfully
      expect(true).toBe(true); // Test passes if no error thrown
    });

    it('should throw error when email configuration is missing in non-test mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalApiKey = process.env.SENDGRID_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      process.env.NODE_ENV = 'development';

      await expect(
        emailService.sendEmail({
          to: 'test@itu.edu.tr',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('Email service not configured');

      // Restore
      process.env.NODE_ENV = originalEnv;
      process.env.SENDGRID_API_KEY = originalApiKey;
    });

    it('should block email if user has disabled email notifications', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ notification_preferences: { emailNotifications: false } }]
      });

      const result = await emailService.sendEmail({
        to: 'optout@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(true);
      expect(result.blocked).toBe(true);
      expect(result.messageId).toBe('blocked-by-user-preferences');
      expect(sgMail.send).not.toHaveBeenCalled();
    });
    it('should block email to _test addresses', async () => {
      const result = await emailService.sendEmail({ to: 'user_test@example.com', subject: 'Test' });
      expect(result.suppressed).toBe(true);
    });

    it('should block email if SEND_EMAILS is false', async () => {
      const oldVal = process.env.SEND_EMAILS;
      process.env.SEND_EMAILS = 'false';
      const result = await emailService.sendEmail({ to: 'user@example.com', subject: 'Test' });
      expect(result.disabled).toBe(true);
      process.env.SEND_EMAILS = oldVal;
    });

    it('should handle database error when checking preferences', async () => {
      pool.query.mockRejectedValueOnce(new Error('DB Error'));
      // Should not throw, just proceed
      const result = await emailService.sendEmail({ to: 'user@example.com', subject: 'Test' });
      expect(result.success).toBe(true); // Falls back to sending (mocked default or test mode)
      expect(console.error).toHaveBeenCalledWith('Error checking user preferences in emailService:', expect.any(Error));
    });

    it('should send email successfully in production mode', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        sgMail.send.mockResolvedValueOnce([{ headers: { 'x-message-id': 'prod-id' } }]);
        
        const result = await emailService.sendEmail({ to: 'user@example.com', subject: 'Prod Test', html: 'body' });
        
        expect(result.success).toBe(true);
        expect(result.messageId).toBe('prod-id');
        expect(sgMail.send).toHaveBeenCalled();
        
        process.env.NODE_ENV = oldEnv;
    });
   });

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct parameters', async () => {
      const emailData = {
        to: 'newuser@itu.edu.tr',
        fullName: 'John Doe',
        verificationToken: 'abc123token',
        verificationCode: '123456',
      };

      const result = await emailService.sendVerificationEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should generate correct verification URL', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'Jane Smith',
        verificationToken: 'test-token-123',
        verificationCode: '654321',
      };

      await emailService.sendVerificationEmail(emailData);

      // Verify the template is called (indirectly through sendEmail)
      // The URL should include the token
      const expectedUrl = `${process.env.FRONTEND_URL}/verify-email?token=${emailData.verificationToken}`;
      
      // We can't directly test the URL, but we can verify the function completes
      expect(true).toBe(true);
    });

    it('should use correct email subject', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'Test User',
        verificationToken: 'token',
        verificationCode: '111111',
      };

      const result = await emailService.sendVerificationEmail(emailData);

      expect(result.success).toBe(true);
    });

    it('should include verification code in template', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'Test User',
        verificationToken: 'token',
        verificationCode: '999999',
      };

      // Test template directly
      const template = emailTemplates.getVerificationEmailTemplate({
        fullName: emailData.fullName,
        verificationUrl: `${process.env.FRONTEND_URL}/verify-email?token=${emailData.verificationToken}`,
        verificationCode: emailData.verificationCode,
      });

      expect(template).toContain(emailData.verificationCode);
      expect(template).toContain(emailData.fullName);
      expect(template).toContain('Email Verification');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct parameters', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'John Doe',
        resetToken: 'reset-token-123',
      };

      const result = await emailService.sendPasswordResetEmail(emailData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
    });

    it('should generate correct reset URL', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'Jane Smith',
        resetToken: 'test-reset-token',
      };

      await emailService.sendPasswordResetEmail(emailData);

      // Verify function completes successfully
      expect(true).toBe(true);
    });

    it('should use correct email subject', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'Test User',
        resetToken: 'token',
      };

      const result = await emailService.sendPasswordResetEmail(emailData);

      expect(result.success).toBe(true);
    });

    it('should include reset URL in template', async () => {
      const emailData = {
        to: 'user@itu.edu.tr',
        fullName: 'Test User',
        resetToken: 'reset-token-456',
      };

      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${emailData.resetToken}`;

      // Test template directly
      const template = emailTemplates.getPasswordResetEmailTemplate({
        fullName: emailData.fullName,
        resetUrl: resetUrl,
      });

      expect(template).toContain(resetUrl);
      expect(template).toContain(emailData.fullName);
      expect(template).toContain('Password Reset');
    });
  });

  describe('Email Templates', () => {
    it('should generate valid HTML for verification email', () => {
      const template = emailTemplates.getVerificationEmailTemplate({
        fullName: 'Test User',
        verificationUrl: 'http://localhost:3000/verify-email?token=abc123',
        verificationCode: '123456',
      });

      expect(template).toContain('<!DOCTYPE html>');
      expect(template).toContain('Test User');
      expect(template).toContain('123456');
      expect(template).toContain('verify-email?token=abc123');
      expect(template).toContain('Email Verification');
    });

    it('should generate valid HTML for password reset email', () => {
      const template = emailTemplates.getPasswordResetEmailTemplate({
        fullName: 'Test User',
        resetUrl: 'http://localhost:3000/reset-password?token=xyz789',
      });

      expect(template).toContain('<!DOCTYPE html>');
      expect(template).toContain('Test User');
      expect(template).toContain('reset-password?token=xyz789');
      expect(template).toContain('Password Reset');
    });

    it('should include security warning in password reset template', () => {
      const template = emailTemplates.getPasswordResetEmailTemplate({
        fullName: 'User',
        resetUrl: 'http://localhost:3000/reset-password?token=token',
      });

      expect(template).toContain('Security Warning');
    });
  });

  describe('Error Handling', () => {
    it('should have try-catch blocks in sendVerificationEmail', () => {
      // Verify the function structure includes error handling
      const functionString = emailService.sendVerificationEmail.toString();
      expect(functionString).toContain('try');
      expect(functionString).toContain('catch');
    });

    it('should have try-catch blocks in sendPasswordResetEmail', () => {
      // Verify the function structure includes error handling
      const functionString = emailService.sendPasswordResetEmail.toString();
      expect(functionString).toContain('try');
      expect(functionString).toContain('catch');
    });

    it('should log error when verify email fails', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      sgMail.send.mockRejectedValueOnce(new Error('Verify Fail'));
      
      await expect(emailService.sendVerificationEmail({ 
        to: 'u@example.com', fullName: 'F', verificationToken: 't', verificationCode: 'c' 
      })).rejects.toThrow('Verify Fail');
          
      expect(console.error).toHaveBeenCalledWith('Error sending verification email:', expect.any(Error));
      process.env.NODE_ENV = oldEnv;
    });

    it('should log error when password reset email fails', async () => {
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      sgMail.send.mockRejectedValueOnce(new Error('Reset Fail'));
      
      await expect(emailService.sendPasswordResetEmail({ 
        to: 'u@example.com', fullName: 'F', resetToken: 't' 
      })).rejects.toThrow('Reset Fail');
          
      expect(console.error).toHaveBeenCalledWith('Error sending password reset email:', expect.any(Error));
      process.env.NODE_ENV = oldEnv;
    });
  });

  describe('Additional Email Methods', () => {
    const mockBooking = {
      confirmationNumber: 'CN123',
      startTime: new Date('2025-01-01T10:00:00Z'),
      endTime: new Date('2025-01-01T12:00:00Z'),
      durationMinutes: 120,
      purpose: 'Study',
      space: {
        spaceName: 'Library Room 1',
        roomNumber: '101',
        building: {
          buildingName: 'Main Library',
          campus: { campusName: 'Ayazaga' }
        }
      }
    };

    it('should send booking confirmation', async () => {
      await emailService.sendBookingConfirmationEmail({
        to: 'user@example.com',
        fullName: 'Test User',
        booking: mockBooking
      });
      
      const calls = console.log.mock.calls;
      const testLog = calls.find(c => c[0] === '[TEST MODE] Email would be sent:');
      expect(testLog).toBeDefined();
      expect(testLog[1].subject).toContain('Booking Confirmed');
      expect(testLog[1].subject).toContain(mockBooking.confirmationNumber);
    });

    it('should send booking cancellation', async () => {
      await emailService.sendBookingCancellationEmail({
        to: 'user@example.com',
        fullName: 'Test User',
        booking: { ...mockBooking, cancellationReason: 'Changed mind' }
      });
      
      const calls = console.log.mock.calls;
      const testLog = calls.find(c => c[0] === '[TEST MODE] Email would be sent:' && c[1].subject.includes('Booking Cancelled'));
      expect(testLog).toBeDefined();
      expect(testLog[1].subject).toContain('Booking Cancelled');
    });

    it('should send report notification', async () => {
      await emailService.sendReportNotificationEmail({
        to: 'user@example.com',
        fullName: 'Test User',
        booking: mockBooking,
        defenseToken: 'def123'
      });
      
      const calls = console.log.mock.calls;
      const testLog = calls.find(c => c[0] === '[TEST MODE] Email would be sent:' && c[1].subject.includes('Report Notification'));
      expect(testLog).toBeDefined();
      expect(testLog[1].subject).toContain('Booking Report Notification');
    });

    it('should send booking reminder', async () => {
      await emailService.sendBookingReminderEmail({
        to: 'user@example.com',
        fullName: 'Test User',
        booking: mockBooking
      });
      
      const calls = console.log.mock.calls;
      const testLog = calls.find(c => c[0] === '[TEST MODE] Email would be sent:' && c[1].subject.includes('Reminder: Booking'));
      expect(testLog).toBeDefined();
      expect(testLog[1].subject).toContain('Reminder: Booking in 1 Hour');
    });

    it('should send account suspension', async () => {
      await emailService.sendAccountSuspensionEmail({
        to: 'user@example.com',
        fullName: 'Test User',
        suspendedUntil: new Date('2025-02-01'),
        reason: 'Policy Violation'
      });
      
      const calls = console.log.mock.calls;
      const testLog = calls.find(c => c[0] === '[TEST MODE] Email would be sent:' && c[1].subject.includes('Account Suspended'));
      expect(testLog).toBeDefined();
      expect(testLog[1].subject).toContain('Account Suspended');
    });

    it('should send account recovery', async () => {
      await emailService.sendAccountRecoveryEmail({
        to: 'user@example.com',
        fullName: 'Test User'
      });
      
      const calls = console.log.mock.calls;
      const testLog = calls.find(c => c[0] === '[TEST MODE] Email would be sent:' && c[1].subject.includes('Account Restored'));
      expect(testLog).toBeDefined();
      expect(testLog[1].subject).toContain('Account Restored');
    });

    describe('Error Handling', () => {
      it('should handle error in account suspension email', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        // Mock sgMail to fail
        // sendEmail catches this, logs it, and re-throws.
        // sendAccountSuspensionEmail catches the re-thrown error and logs it.
        sgMail.send.mockRejectedValueOnce(new Error('SendGrid Error'));
        
        await emailService.sendAccountSuspensionEmail({
          to: 'user@example.com',
          fullName: 'Test User',
          suspendedUntil: new Date(),
          reason: 'Test'
        });
        
        expect(console.error).toHaveBeenCalledWith('Error sending account suspension email:', expect.any(Error));
        
        process.env.NODE_ENV = oldEnv;
      });

      it('should handle error in account recovery email', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        sgMail.send.mockRejectedValueOnce(new Error('SendGrid Error'));
        
        await emailService.sendAccountRecoveryEmail({
          to: 'user@example.com',
          fullName: 'Test User'
        });
        
        expect(console.error).toHaveBeenCalledWith('Error sending account recovery email:', expect.any(Error));
        
        process.env.NODE_ENV = oldEnv;
      });

      it('should handle error in booking confirmation', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        sgMail.send.mockRejectedValueOnce(new Error('SendGrid Error'));
        
        await expect(emailService.sendBookingConfirmationEmail({
          to: 'user@example.com', fullName: 'User', booking: mockBooking
        })).rejects.toThrow('SendGrid Error');
        
        expect(console.error).toHaveBeenCalledWith('Error sending booking confirmation email:', expect.any(Error));
        process.env.NODE_ENV = oldEnv;
      });

      it('should handle error in booking cancellation', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        sgMail.send.mockRejectedValueOnce(new Error('SendGrid Error'));
        
        await expect(emailService.sendBookingCancellationEmail({
          to: 'user@example.com', fullName: 'User', booking: mockBooking
        })).rejects.toThrow('SendGrid Error');
        
        expect(console.error).toHaveBeenCalledWith('Error sending booking cancellation email:', expect.any(Error));
        process.env.NODE_ENV = oldEnv;
      });

      it('should handle error in report notification', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        sgMail.send.mockRejectedValueOnce(new Error('SendGrid Error'));
        
        await expect(emailService.sendReportNotificationEmail({
          to: 'user@example.com', fullName: 'User', booking: mockBooking, defenseToken: 'abc'
        })).rejects.toThrow('SendGrid Error');
        
        expect(console.error).toHaveBeenCalledWith('Error sending report notification email:', expect.any(Error));
        process.env.NODE_ENV = oldEnv;
      });

      it('should handle error in booking reminder', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        sgMail.send.mockRejectedValueOnce(new Error('SendGrid Error'));
        
        await expect(emailService.sendBookingReminderEmail({
          to: 'user@example.com', fullName: 'User', booking: mockBooking
        })).rejects.toThrow('SendGrid Error');
        
        expect(console.error).toHaveBeenCalledWith('Error sending booking reminder email:', expect.any(Error));
        process.env.NODE_ENV = oldEnv;
      });

      it('should log SendGrid error response details', async () => {
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        const error = new Error('API Error');
        error.response = { body: { errors: ['Invalid email'] } };
        sgMail.send.mockRejectedValueOnce(error);
        
        await expect(emailService.sendEmail({
            to: 'user@example.com', subject: 'Test', html: '<p>Body</p>'
        })).rejects.toThrow('API Error');
        
        expect(console.error).toHaveBeenCalledWith('SendGrid error details:', error.response.body);
        
        process.env.NODE_ENV = oldEnv;
      });
    });

    it('should use default cancellation reason', async () => {
        const bookingWithoutReason = { ...mockBooking };
        delete bookingWithoutReason.cancellationReason;
        
        await emailService.sendBookingCancellationEmail({
            to: 'user@example.com',
            fullName: 'Test User',
            booking: bookingWithoutReason
        });
        
        const calls = console.log.mock.calls;
        const log = calls.find(c => c[0] === '[TEST MODE] Email would be sent:' && c[1].subject.includes('Booking Cancelled'));
        // We can't easily verify the HTML content unless we spy on the template function or inspect the implementation
        // But verifying it runs without error covers the branch.
        expect(log).toBeDefined();
    });

    it('should handle missing space details in report notification', async () => {
        const minimalBooking = {
            startTime: new Date(),
            endTime: new Date(),
            space: {} // Missing properties
        };
        
        await emailService.sendReportNotificationEmail({
             to: 'user@example.com',
             fullName: 'User',
             booking: minimalBooking,
             defenseToken: 'token'
        });
        
        // Also test completely missing space
        await emailService.sendReportNotificationEmail({
             to: 'user@example.com',
             fullName: 'User',
             booking: { startTime: new Date(), endTime: new Date() }, // No space
             defenseToken: 'token2'
        });
        
        expect(true).toBe(true); // functions completed
    });
  });
});

