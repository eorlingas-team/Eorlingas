/**
 * Auth Unit Tests
 * Tests for authentication, JWT utilities, validation, and middleware
 */

// Mock environment variables
process.env.JWT_SECRET = 'test_secret_key';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_key';
process.env.JWT_EXPIRES_IN = '86400';
process.env.JWT_REFRESH_EXPIRES_IN = '604800';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Import modules to test
const jwtUtils = require('../utils/jwtUtils');
const validationSchemas = require('../utils/validationSchemas');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

// Mock dependencies
jest.mock('../models/userModel');
jest.mock('../config/db');
jest.mock('bcrypt');

const userModel = require('../models/userModel');
const pool = require('../config/db');

describe('JWT Utils', () => {
  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const payload = {
        userId: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
      };

      const token = jwtUtils.generateAccessToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should include expiration in token', () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const payload = {
        userId: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
      };

      const token = jwtUtils.generateRefreshToken(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify token can be decoded
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.type).toBe('refresh');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload);
      const decoded = jwtUtils.verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtUtils.verifyAccessToken('invalid_token');
      }).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1s' });

      expect(() => {
        jwtUtils.verifyAccessToken(token);
      }).toThrow('Token expired');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateRefreshToken(payload);
      const decoded = jwtUtils.verifyRefreshToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        jwtUtils.verifyRefreshToken('invalid_token');
      }).toThrow('Invalid refresh token');
    });

    it('should throw error if token type is not refresh', () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload); // Access token, not refresh

      expect(() => {
        jwtUtils.verifyRefreshToken(token);
      }).toThrow();
    });
  });

  describe('getTokenExpirationTime', () => {
    it('should return token expiration time', () => {
      const expiresIn = jwtUtils.getTokenExpirationTime();
      expect(expiresIn).toBe(86400);
    });
  });
});

describe('Validation Schemas', () => {
  describe('isValidEmail', () => {
    it('should validate email addresses correctly', () => {
      // Valid ITU emails
      expect(validationSchemas.isValidEmail('test@itu.edu.tr')).toBe(true);
      expect(validationSchemas.isValidEmail('user.name@itu.edu.tr')).toBe(true);
      
      // Invalid emails
      expect(validationSchemas.isValidEmail('test@gmail.com')).toBe(false);
      expect(validationSchemas.isValidEmail('test@itu.edu')).toBe(false);
      expect(validationSchemas.isValidEmail('invalid')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(validationSchemas.validatePassword('Password123').valid).toBe(true);
      expect(validationSchemas.validatePassword('MyStr0ng!Pass').valid).toBe(true);
    });

    it('should reject short passwords', () => {
      const result = validationSchemas.validatePassword('Short1');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('8 characters');
    });

    it('should reject passwords without uppercase', () => {
      const result = validationSchemas.validatePassword('password123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('uppercase');
    });

    it('should reject passwords without lowercase', () => {
      const result = validationSchemas.validatePassword('PASSWORD123');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('lowercase');
    });

    it('should reject passwords without numbers', () => {
      const result = validationSchemas.validatePassword('Password');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('number');
    });
  });

  describe('isValidStudentNumber', () => {
    it('should validate student numbers correctly', () => {
      // Valid student numbers
      expect(validationSchemas.isValidStudentNumber('123456')).toBe(true);
      expect(validationSchemas.isValidStudentNumber('123456789012')).toBe(true);
      
      // Invalid student numbers
      expect(validationSchemas.isValidStudentNumber('12345')).toBe(false);
      expect(validationSchemas.isValidStudentNumber('abc123')).toBe(false);
      expect(validationSchemas.isValidStudentNumber('1234567890123')).toBe(false);
      
      // Empty values are allowed
      expect(validationSchemas.isValidStudentNumber('')).toBe(true);
      expect(validationSchemas.isValidStudentNumber(null)).toBe(true);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('should validate phone numbers correctly', () => {
      // Valid Turkish phone numbers
      expect(validationSchemas.isValidPhoneNumber('5551234567')).toBe(true);
      expect(validationSchemas.isValidPhoneNumber('05551234567')).toBe(true);
      expect(validationSchemas.isValidPhoneNumber('+905551234567')).toBe(true);
      
      // Invalid phone numbers
      expect(validationSchemas.isValidPhoneNumber('12345')).toBe(false);
      expect(validationSchemas.isValidPhoneNumber('55512345')).toBe(false);
      
      // Empty values are allowed
      expect(validationSchemas.isValidPhoneNumber('')).toBe(true);
      expect(validationSchemas.isValidPhoneNumber(null)).toBe(true);
    });
  });

  describe('validateRegistration', () => {
    it('should validate valid registration data', () => {
      const data = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
        passwordConfirmation: 'Password123',
        fullName: 'Test User',
        studentNumber: '123456',
        phoneNumber: '5551234567',
      };

      const result = validationSchemas.validateRegistration(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'test@gmail.com',
        password: 'Password123',
        passwordConfirmation: 'Password123',
        fullName: 'Test User',
      };

      const result = validationSchemas.validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject mismatched passwords', () => {
      const data = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
        passwordConfirmation: 'Different123',
        fullName: 'Test User',
      };

      const result = validationSchemas.validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('match'))).toBe(true);
    });

    it('should reject short full name', () => {
      const data = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
        passwordConfirmation: 'Password123',
        fullName: 'A',
      };

      const result = validationSchemas.validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });
  });

  describe('validateLogin', () => {
    it('should validate valid login data', () => {
      const data = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
      };

      const result = validationSchemas.validateLogin(data);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email', () => {
      const data = {
        email: 'test@gmail.com',
        password: 'Password123',
      };

      const result = validationSchemas.validateLogin(data);
      expect(result.valid).toBe(false);
    });

    it('should reject missing password', () => {
      const data = {
        email: 'test@itu.edu.tr',
      };

      const result = validationSchemas.validateLogin(data);
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePasswordChange', () => {
    it('should validate valid password change', () => {
      const data = {
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
        newPasswordConfirmation: 'NewPassword123',
      };

      const result = validationSchemas.validatePasswordChange(data);
      expect(result.valid).toBe(true);
    });

    it('should reject if new password same as current', () => {
      const data = {
        currentPassword: 'Password123',
        newPassword: 'Password123',
        newPasswordConfirmation: 'Password123',
      };

      const result = validationSchemas.validatePasswordChange(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('different'))).toBe(true);
    });

    it('should reject mismatched new passwords', () => {
      const data = {
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
        newPasswordConfirmation: 'Different123',
      };

      const result = validationSchemas.validatePasswordChange(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('match'))).toBe(true);
    });
  });
});

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      req.body = {
        email: 'newuser@itu.edu.tr',
        password: 'Password123',
        passwordConfirmation: 'Password123',
        fullName: 'New User',
        studentNumber: '123456',
        phoneNumber: '5551234567',
      };

      userModel.findByEmail.mockResolvedValue(null);
      userModel.create.mockResolvedValue({
        user_id: 1,
        email: 'newuser@itu.edu.tr',
        status: 'Unverified',
      });
      userModel.setVerificationToken.mockResolvedValue(undefined);
      bcrypt.hash.mockResolvedValue('hashed_password');

      await authController.register(req, res, next);

      expect(userModel.findByEmail).toHaveBeenCalledWith('newuser@itu.edu.tr');
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(userModel.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Registration successful'),
        })
      );
    });

    it('should reject duplicate email', async () => {
      req.body = {
        email: 'existing@itu.edu.tr',
        password: 'Password123',
        passwordConfirmation: 'Password123',
        fullName: 'Existing User',
      };

      userModel.findByEmail.mockResolvedValue({
        user_id: 1,
        email: 'existing@itu.edu.tr',
      });

      await authController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'DUPLICATE_ENTRY',
          }),
        })
      );
    });

    it('should reject invalid registration data', async () => {
      req.body = {
        email: 'invalid-email',
        password: 'short',
        passwordConfirmation: 'short',
        fullName: 'A',
      };

      await authController.register(req, res, next);

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
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      req.body = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        role: 'Student',
        status: 'Verified',
      };

      userModel.findByEmail.mockResolvedValue(mockUser);
      userModel.getRecentFailedLoginAttempts.mockResolvedValue(0);
      bcrypt.compare.mockResolvedValue(true);
      userModel.updateLastLogin.mockResolvedValue(undefined);
      pool.query.mockResolvedValue({ rows: [] });

      await authController.login(req, res, next);

      expect(userModel.findByEmail).toHaveBeenCalledWith('test@itu.edu.tr');
      expect(bcrypt.compare).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: expect.any(String),
            refreshToken: expect.any(String),
          }),
        })
      );
    });

    it('should reject invalid email', async () => {
      req.body = {
        email: 'nonexistent@itu.edu.tr',
        password: 'Password123',
      };

      userModel.findByEmail.mockResolvedValue(null);
      pool.query.mockResolvedValue({ rows: [] });

      await authController.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'AUTHENTICATION_FAILED',
          }),
        })
      );
    });

    it('should reject invalid password', async () => {
      req.body = {
        email: 'test@itu.edu.tr',
        password: 'WrongPassword',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_password',
        status: 'Verified',
      };

      userModel.findByEmail.mockResolvedValue(mockUser);
      userModel.getRecentFailedLoginAttempts.mockResolvedValue(0);
      bcrypt.compare.mockResolvedValue(false);
      pool.query.mockResolvedValue({ rows: [] });

      await authController.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'AUTHENTICATION_FAILED',
          }),
        })
      );
    });

    it('should reject unverified account', async () => {
      req.body = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_password',
        status: 'Unverified',
      };

      userModel.findByEmail.mockResolvedValue(mockUser);
      userModel.getRecentFailedLoginAttempts.mockResolvedValue(0);
      bcrypt.compare.mockResolvedValue(true);

      await authController.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN',
          }),
        })
      );
    });

    it('should reject account with too many failed attempts', async () => {
      req.body = {
        email: 'test@itu.edu.tr',
        password: 'Password123',
      };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        password_hash: 'hashed_password',
        status: 'Verified',
      };

      userModel.findByEmail.mockResolvedValue(mockUser);
      userModel.getRecentFailedLoginAttempts.mockResolvedValue(5);

      await authController.login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'TOO_MANY_REQUESTS',
          }),
        })
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      req.body = { token: 'valid_token' };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        email_verified: false,
        status: 'Unverified',
        verification_token_expiry: new Date(Date.now() + 3600000),
      };

      userModel.findByVerificationToken.mockResolvedValue(mockUser);
      userModel.update.mockResolvedValue({
        ...mockUser,
        status: 'Verified',
        email_verified: true,
      });
      userModel.clearVerificationToken.mockResolvedValue(undefined);
      pool.query.mockResolvedValue({ rows: [] });

      await authController.verifyEmail(req, res, next);

      expect(userModel.findByVerificationToken).toHaveBeenCalledWith('valid_token');
      expect(userModel.update).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should reject invalid token', async () => {
      req.body = { token: 'invalid_token' };

      userModel.findByVerificationToken.mockResolvedValue(null);

      await authController.verifyEmail(req, res, next);

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

    it('should reject expired token', async () => {
      req.body = { token: 'expired_token' };

      const mockUser = {
        user_id: 1,
        verification_token_expiry: new Date(Date.now() - 3600000), // 1 hour ago
      };

      userModel.findByVerificationToken.mockResolvedValue(mockUser);

      await authController.verifyEmail(req, res, next);

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
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const refreshToken = jwtUtils.generateRefreshToken(payload);

      req.body = { refreshToken };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
        status: 'Verified',
      };

      userModel.findById.mockResolvedValue(mockUser);

      await authController.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            token: expect.any(String),
            expiresIn: expect.any(Number),
          }),
        })
      );
    });

    it('should reject invalid refresh token', async () => {
      req.body = { refreshToken: 'invalid_token' };

      await authController.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
    });

    it('should reject if user not found', async () => {
      const payload = { userId: 999, email: 'test@itu.edu.tr', role: 'Student' };
      const refreshToken = jwtUtils.generateRefreshToken(payload);

      req.body = { refreshToken };
      userModel.findById.mockResolvedValue(null);

      await authController.refreshToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
    });
  });

  describe('getMe', () => {
    it('should return current user data', async () => {
      req.user = { userId: 1 };

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        full_name: 'Test User',
        student_number: '123456',
        phone_number: '5551234567',
        role: 'Student',
        status: 'Verified',
        email_verified: true,
        registration_date: new Date(),
        last_login: new Date(),
      };

      userModel.findById.mockResolvedValue(mockUser);

      await authController.getMe(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            userId: 1,
            email: 'test@itu.edu.tr',
          }),
        })
      );
    });

    it('should return 404 if user not found', async () => {
      req.user = { userId: 999 };
      userModel.findById.mockResolvedValue(null);

      await authController.getMe(req, res, next);

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
  });
});

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate valid token', async () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload);
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
        status: 'Verified',
      };

      userModel.findById.mockResolvedValue(mockUser);

      await authMiddleware.authenticate(req, res, next);

      expect(userModel.findById).toHaveBeenCalledWith(1);
      expect(req.user).toBeDefined();
      expect(req.user.userId).toBe(1);
      expect(next).toHaveBeenCalled();
    });

    it('should reject missing authorization header', async () => {
      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      req.headers.authorization = 'Bearer invalid_token';

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject if user not found', async () => {
      const payload = { userId: 999, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload);
      req.headers.authorization = `Bearer ${token}`;

      userModel.findById.mockResolvedValue(null);

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject suspended account', async () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload);
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
        status: 'Suspended',
      };

      userModel.findById.mockResolvedValue(mockUser);

      await authMiddleware.authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should attach user if valid token provided', async () => {
      const payload = { userId: 1, email: 'test@itu.edu.tr', role: 'Student' };
      const token = jwtUtils.generateAccessToken(payload);
      req.headers.authorization = `Bearer ${token}`;

      const mockUser = {
        user_id: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
        status: 'Verified',
      };

      userModel.findById.mockResolvedValue(mockUser);

      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should continue without user if no token or invalid token provided', async () => {
      // No token provided
      await authMiddleware.optionalAuth(req, res, next);
      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();

      // Reset mocks
      jest.clearAllMocks();

      // Invalid token provided
      req.headers.authorization = 'Bearer invalid_token';
      await authMiddleware.optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});

