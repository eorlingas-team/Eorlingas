/**
 * Profile Unit Tests
 * Tests for profile controller endpoints
 */

// Mock environment variables
process.env.JWT_SECRET = 'test_secret_key';

const bcrypt = require('bcrypt');

// Import modules to test
const profileController = require('../controllers/profileController');
const validationSchemas = require('../utils/validationSchemas');

// Mock dependencies
jest.mock('../models/userModel');
jest.mock('bcrypt');

const userModel = require('../models/userModel');

describe('Profile Controller', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock request object
    req = {
      user: {
        userId: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
      },
      body: {},
    };

    // Mock response object
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock next function
    next = jest.fn();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        student_number: '150230738',
        phone_number: '+90 555 123 4567',
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: '2025-12-15T14:20:00.000Z',
        notification_preferences: {
          emailNotifications: true,
          webNotifications: false,
        },
      };

      userModel.findById.mockResolvedValue(mockUser);

      await profileController.getProfile(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            userId: 1,
            email: 'test@itu.edu.tr',
            fullName: 'Test User',
            notificationPreferences: {
              emailNotifications: true,
              webNotifications: false,
            },
          }),
        })
      );
    });

    it('should return default notification preferences when not set', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        student_number: '150230738',
        phone_number: null,
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: null,
        notification_preferences: null,
      };

      userModel.findById.mockResolvedValue(mockUser);

      await profileController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            notificationPreferences: {
              emailNotifications: true,
              webNotifications: true,
            },
          }),
        })
      );
    });

    it('should parse string notification preferences', async () => {
      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        student_number: '150230738',
        phone_number: null,
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: null,
        notification_preferences: '{"emailNotifications":false,"webNotifications":true}',
      };

      userModel.findById.mockResolvedValue(mockUser);

      await profileController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            notificationPreferences: {
              emailNotifications: false,
              webNotifications: true,
            },
          }),
        })
      );
    });

    it('should return 404 when user not found', async () => {
      userModel.findById.mockResolvedValue(null);

      await profileController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    it('should handle errors and call next', async () => {
      const error = new Error('Database error');
      userModel.findById.mockRejectedValue(error);

      await profileController.getProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully with fullName', async () => {
      req.body = {
        fullName: 'Updated Name',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Updated Name',
        student_number: '150230738',
        phone_number: '+90 555 123 4567',
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: '2025-12-15T14:20:00.000Z',
        notification_preferences: {
          emailNotifications: true,
          webNotifications: true,
        },
      };

      userModel.findById.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue(mockUser);

      await profileController.updateProfile(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith(1);
      expect(userModel.update).toHaveBeenCalledWith(1, {
        full_name: 'Updated Name',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Profile updated successfully',
        })
      );
    });

    it('should update profile successfully with phoneNumber', async () => {
      req.body = {
        phoneNumber: '+90 555 999 8888',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        student_number: '150230738',
        phone_number: '+90 555 999 8888',
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: null,
        notification_preferences: {
          emailNotifications: true,
          webNotifications: true,
        },
      };

      userModel.findById.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue(mockUser);

      await profileController.updateProfile(req, res, next);

      expect(userModel.update).toHaveBeenCalledWith(1, {
        phone_number: '+90 555 999 8888',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update profile successfully with notificationPreferences', async () => {
      req.body = {
        notificationPreferences: {
          emailNotifications: false,
          webNotifications: true,
        },
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        student_number: '150230738',
        phone_number: null,
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: null,
        notification_preferences: '{"emailNotifications":false,"webNotifications":true}',
      };

      userModel.findById.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue(mockUser);

      await profileController.updateProfile(req, res, next);

      expect(userModel.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          notification_preferences: expect.stringContaining('emailNotifications'),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update multiple fields at once', async () => {
      req.body = {
        fullName: 'New Name',
        phoneNumber: '+90 555 111 2222',
        notificationPreferences: {
          emailNotifications: true,
          webNotifications: false,
        },
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'New Name',
        student_number: '150230738',
        phone_number: '+90 555 111 2222',
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: null,
        notification_preferences: '{"emailNotifications":true,"webNotifications":false}',
      };

      userModel.findById.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue(mockUser);

      await profileController.updateProfile(req, res, next);

      expect(userModel.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          full_name: 'New Name',
          phone_number: '+90 555 111 2222',
          notification_preferences: expect.any(String),
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject invalid validation data', async () => {
      req.body = {
        fullName: 'A'.repeat(256), // Exceeds max length
      };

      await profileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should reject invalid phone number', async () => {
      req.body = {
        phoneNumber: 'invalid-phone',
      };

      await profileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should reject invalid notificationPreferences type', async () => {
      req.body = {
        notificationPreferences: 'not-an-object',
      };

      await profileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should reject null notificationPreferences', async () => {
      req.body = {
        notificationPreferences: null,
      };

      await profileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: expect.arrayContaining([
              expect.stringContaining('notificationPreferences'),
            ]),
          }),
        })
      );
    });

    it('should return 400 when no fields to update', async () => {
      req.body = {};

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
      };

      userModel.findById.mockResolvedValue(mockUser);

      await profileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'No valid fields to update',
          }),
        })
      );
    });

    it('should return 404 when user not found', async () => {
      req.body = {
        fullName: 'Updated Name',
      };

      userModel.findById.mockResolvedValue(null);

      await profileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    it('should handle empty string phoneNumber as null', async () => {
      req.body = {
        phoneNumber: '',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        phone_number: null,
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: '2025-11-15T10:30:00.000Z',
        last_login: null,
        notification_preferences: {
          emailNotifications: true,
          webNotifications: true,
        },
      };

      userModel.findById.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue(mockUser);

      await profileController.updateProfile(req, res, next);

      expect(userModel.update).toHaveBeenCalledWith(1, {
        phone_number: null,
      });
    });

    it('should handle errors and call next', async () => {
      req.body = {
        fullName: 'Updated Name',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
      };

      userModel.findById.mockResolvedValue(mockUser);
      const error = new Error('Database error');
      userModel.update.mockRejectedValue(error);

      await profileController.updateProfile(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      req.body = {
        currentPassword: 'OldPass123',
        newPassword: 'NewSecurePass456',
        newPasswordConfirmation: 'NewSecurePass456',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_old_password',
      };

      userModel.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('hashed_new_password');
      userModel.update.mockResolvedValue(mockUser);

      await profileController.changePassword(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith(1);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'OldPass123',
        'hashed_old_password'
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('NewSecurePass456', 10);
      expect(userModel.update).toHaveBeenCalledWith(1, {
        password_hash: 'hashed_new_password',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password changed successfully',
        })
      );
    });

    it('should reject invalid validation data', async () => {
      req.body = {
        currentPassword: 'OldPass123',
        newPassword: 'short', // Too short
        newPasswordConfirmation: 'short',
      };

      await profileController.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should reject when passwords do not match', async () => {
      req.body = {
        currentPassword: 'OldPass123',
        newPassword: 'NewSecurePass456',
        newPasswordConfirmation: 'DifferentPass789',
      };

      await profileController.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
    });

    it('should reject when current password is incorrect', async () => {
      req.body = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewSecurePass456',
        newPasswordConfirmation: 'NewSecurePass456',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_old_password',
      };

      userModel.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(false);

      await profileController.changePassword(req, res, next);

      expect(bcrypt.compare).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Current password is incorrect',
          }),
        })
      );
      expect(userModel.update).not.toHaveBeenCalled();
    });

    it('should return 404 when user not found', async () => {
      req.body = {
        currentPassword: 'OldPass123',
        newPassword: 'NewSecurePass456',
        newPasswordConfirmation: 'NewSecurePass456',
      };

      userModel.findById.mockResolvedValue(null);

      await profileController.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
    });

    it('should handle errors and call next', async () => {
      req.body = {
        currentPassword: 'OldPass123',
        newPassword: 'NewSecurePass456',
        newPasswordConfirmation: 'NewSecurePass456',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_old_password',
      };

      userModel.findById.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      const error = new Error('Database error');
      bcrypt.hash.mockRejectedValue(error);

      await profileController.changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

describe('Validation Schemas - Profile', () => {
  describe('validateProfileUpdate', () => {
    it('should validate valid profile update data', () => {
      const data = {
        fullName: 'John Doe',
        phoneNumber: '+90 555 123 4567',
        notificationPreferences: {
          emailNotifications: true,
          webNotifications: false,
        },
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept partial updates', () => {
      const data = {
        fullName: 'John Doe',
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(true);
    });

    it('should reject fullName exceeding max length', () => {
      const data = {
        fullName: 'A'.repeat(256),
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('255 characters'))).toBe(true);
    });

    it('should reject empty fullName', () => {
      const data = {
        fullName: '   ',
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('empty'))).toBe(true);
    });

    it('should reject invalid phone number', () => {
      const data = {
        phoneNumber: 'invalid-phone',
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('phoneNumber'))).toBe(true);
    });

    it('should accept null phoneNumber', () => {
      const data = {
        phoneNumber: null,
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid notificationPreferences type', () => {
      const data = {
        notificationPreferences: 'not-an-object',
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('object'))).toBe(true);
    });

    it('should reject non-boolean emailNotifications', () => {
      const data = {
        notificationPreferences: {
          emailNotifications: 'not-a-boolean',
        },
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('boolean'))).toBe(true);
    });

    it('should reject non-boolean webNotifications', () => {
      const data = {
        notificationPreferences: {
          webNotifications: 'not-a-boolean',
        },
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('boolean'))).toBe(true);
    });

    it('should accept valid notificationPreferences', () => {
      const data = {
        notificationPreferences: {
          emailNotifications: true,
          webNotifications: false,
        },
      };

      const result = validationSchemas.validateProfileUpdate(data);
      expect(result.valid).toBe(true);
    });
  });
});

