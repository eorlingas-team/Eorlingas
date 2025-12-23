/**
 * Booking Unit Tests
 * Tests for booking controller endpoints and validation
 */

process.env.JWT_SECRET = 'test_secret_key';

const bookingController = require('../controllers/bookingController');
const bookingService = require('../services/bookingService');
const bookingModel = require('../models/bookingModel');
const validationSchemas = require('../utils/validationSchemas');

jest.mock('../services/bookingService');
jest.mock('../models/bookingModel');
jest.mock('../utils/auditLogger');

const logAuditEvent = require('../utils/auditLogger');
const actualBookingService = jest.requireActual('../services/bookingService');

describe('Booking Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        userId: 1,
        email: 'test@itu.edu.tr',
        role: 'Student',
      },
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1',
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();
  });

  describe('createBooking', () => {
    it('should create a booking successfully', async () => {
      req.body = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
        purpose: 'Group study',
      };

      const mockBooking = {
        bookingId: 123,
        userId: 1,
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
        durationMinutes: 120,
        purpose: 'Group study',
        status: 'Confirmed',
        confirmationNumber: 'ABC123XYZ9',
        space: {
          spaceId: 1,
          spaceName: 'Library Study Room 101',
          roomNumber: '101',
          building: {
            buildingId: 1,
            buildingName: 'Library Building',
            campus: {
              campusId: 1,
              campusName: 'Ayazağa Campus',
            },
          },
        },
      };

      bookingService.validateBookingRequest.mockReturnValue({ valid: true, errors: [] });
      bookingService.createBooking.mockResolvedValue(mockBooking);

      await bookingController.createBooking(req, res, next);

      expect(bookingService.validateBookingRequest).toHaveBeenCalled();
      expect(bookingService.createBooking).toHaveBeenCalledWith(1, {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
        purpose: 'Group study',
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            booking: mockBooking,
            confirmationNumber: 'ABC123XYZ9',
          }),
        })
      );
    });

    it('should create booking without purpose', async () => {
      req.body = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
      };

      const mockBooking = {
        bookingId: 123,
        confirmationNumber: 'ABC123XYZ9',
        purpose: null,
      };

      bookingService.validateBookingRequest.mockReturnValue({ valid: true, errors: [] });
      bookingService.createBooking.mockResolvedValue(mockBooking);

      await bookingController.createBooking(req, res, next);

      expect(bookingService.validateBookingRequest).toHaveBeenCalled();
      expect(bookingService.createBooking).toHaveBeenCalledWith(1, {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
        purpose: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 for validation errors', async () => {
      req.body = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T13:00:00.000Z', // endTime before startTime
      };

      bookingService.validateBookingRequest.mockReturnValue({
        valid: false,
        errors: ['endTime must be after startTime'],
      });

      await bookingController.createBooking(req, res, next);

      expect(bookingService.validateBookingRequest).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
          }),
        })
      );
      expect(bookingService.createBooking).not.toHaveBeenCalled();
    });

    it('should return 404 when space not found', async () => {
      req.body = {
        spaceId: 999,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
      };

      bookingService.validateBookingRequest.mockReturnValue({ valid: true, errors: [] });
      const error = new Error('Space not found');
      error.statusCode = 404;
      error.code = 'NOT_FOUND';
      bookingService.createBooking.mockRejectedValue(error);

      await bookingController.createBooking(req, res, next);

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

    it('should return 409 for booking conflicts', async () => {
      req.body = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
      };

      bookingService.validateBookingRequest.mockReturnValue({ valid: true, errors: [] });
      const error = new Error('Space is already booked at this time');
      error.statusCode = 409;
      error.code = 'CONFLICT';
      bookingService.createBooking.mockRejectedValue(error);

      await bookingController.createBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
          }),
        })
      );
    });

    it('should handle database constraint violations', async () => {
      req.body = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
      };

      bookingService.validateBookingRequest.mockReturnValue({ valid: true, errors: [] });
      const error = new Error('Duplicate booking');
      error.code = '23505'; // PostgreSQL unique constraint violation
      bookingService.createBooking.mockRejectedValue(error);

      await bookingController.createBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CONFLICT',
            message: 'Space is already booked at this time',
          }),
        })
      );
    });

    it('should handle errors and call next', async () => {
      req.body = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
      };

      bookingService.validateBookingRequest.mockReturnValue({ valid: true, errors: [] });
      const error = new Error('Database error');
      bookingService.createBooking.mockRejectedValue(error);

      await bookingController.createBooking(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getUserBookings', () => {
    it('should return user bookings successfully', async () => {
      const mockResult = {
        upcoming: [
          {
            bookingId: 123,
            spaceId: 1,
            startTime: '2025-12-20T14:00:00.000Z',
            endTime: '2025-12-20T16:00:00.000Z',
            status: 'Confirmed',
          },
        ],
        past: [
          {
            bookingId: 122,
            spaceId: 2,
            startTime: '2025-12-10T10:00:00.000Z',
            endTime: '2025-12-10T12:00:00.000Z',
            status: 'Completed',
          },
        ],
        statistics: {
          totalBookings: 2,
          upcomingCount: 1,
          pastCount: 1,
          cancelledCount: 0,
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      };

      bookingService.getUserBookings.mockResolvedValue(mockResult);

      await bookingController.getUserBookings(req, res, next);

      expect(bookingService.getUserBookings).toHaveBeenCalledWith(1, {});
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult,
        })
      );
    });

    it('should filter by type=upcoming', async () => {
      req.query = { type: 'upcoming' };

      const mockResult = {
        upcoming: [
          {
            bookingId: 123,
            status: 'Confirmed',
          },
        ],
        statistics: {
          totalBookings: 1,
          upcomingCount: 1,
          pastCount: 0,
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      bookingService.getUserBookings.mockResolvedValue(mockResult);

      await bookingController.getUserBookings(req, res, next);

      expect(bookingService.getUserBookings).toHaveBeenCalledWith(1, {
        type: 'upcoming',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            upcoming: expect.any(Array),
          }),
        })
      );
    });

    it('should filter by type=past', async () => {
      req.query = { type: 'past' };

      const mockResult = {
        past: [
          {
            bookingId: 122,
            status: 'Completed',
          },
        ],
        statistics: {
          totalBookings: 1,
          upcomingCount: 0,
          pastCount: 1,
        },
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      bookingService.getUserBookings.mockResolvedValue(mockResult);

      await bookingController.getUserBookings(req, res, next);

      expect(bookingService.getUserBookings).toHaveBeenCalledWith(1, {
        type: 'past',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            past: expect.any(Array),
          }),
        })
      );
    });

    it('should handle pagination', async () => {
      req.query = { page: '2', limit: '10' };

      const mockResult = {
        upcoming: [],
        past: [],
        statistics: {
          totalBookings: 0,
          upcomingCount: 0,
          pastCount: 0,
        },
        pagination: {
          page: 2,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      };

      bookingService.getUserBookings.mockResolvedValue(mockResult);

      await bookingController.getUserBookings(req, res, next);

      expect(bookingService.getUserBookings).toHaveBeenCalledWith(1, {
        page: '2',
        limit: '10',
      });
    });

    it('should handle errors and call next', async () => {
      const error = new Error('Database error');
      bookingService.getUserBookings.mockRejectedValue(error);

      await bookingController.getUserBookings(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getBookingById', () => {
    it('should return booking by ID successfully', async () => {
      req.params = { id: '123' };

      const mockBooking = {
        bookingId: 123,
        userId: 1,
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
        status: 'Confirmed',
        confirmationNumber: 'ABC123XYZ9',
        space: {
          spaceId: 1,
          spaceName: 'Library Study Room 101',
        },
      };

      bookingModel.findByIdWithSpace.mockResolvedValue(mockBooking);

      await bookingController.getBookingById(req, res, next);

      expect(bookingModel.findByIdWithSpace).toHaveBeenCalledWith(123);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            booking: mockBooking,
          }),
        })
      );
    });

    it('should return 404 when booking not found', async () => {
      req.params = { id: '999' };

      bookingModel.findByIdWithSpace.mockResolvedValue(null);

      await bookingController.getBookingById(req, res, next);

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

    it('should return 403 when user is not owner and not admin/space manager', async () => {
      req.params = { id: '123' };
      req.user.role = 'Student';
      req.user.userId = 2; // Different user

      const mockBooking = {
        bookingId: 123,
        userId: 1, // Different user owns this booking
      };

      bookingModel.findByIdWithSpace.mockResolvedValue(mockBooking);

      await bookingController.getBookingById(req, res, next);

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

    it('should allow admin to view any booking', async () => {
      req.params = { id: '123' };
      req.user.role = 'Administrator';
      req.user.userId = 2; // Different user

      const mockBooking = {
        bookingId: 123,
        userId: 1, // Different user owns this booking
      };

      bookingModel.findByIdWithSpace.mockResolvedValue(mockBooking);

      await bookingController.getBookingById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should allow space manager to view any booking', async () => {
      req.params = { id: '123' };
      req.user.role = 'Space_Manager';
      req.user.userId = 2;

      const mockBooking = {
        bookingId: 123,
        userId: 1,
      };

      bookingModel.findByIdWithSpace.mockResolvedValue(mockBooking);

      await bookingController.getBookingById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle errors and call next', async () => {
      req.params = { id: '123' };

      const error = new Error('Database error');
      bookingModel.findByIdWithSpace.mockRejectedValue(error);

      await bookingController.getBookingById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      req.params = { id: '123' };
      req.body = { reason: 'User_Requested' };

      const mockBooking = {
        bookingId: 123,
        userId: 1,
        status: 'Confirmed',
        startTime: '2025-12-20T14:00:00.000Z',
      };

      const mockCancelledBooking = {
        bookingId: 123,
        status: 'Cancelled',
        cancelledAt: '2025-12-15T10:00:00.000Z',
        cancellationReason: 'User_Requested',
      };

      bookingModel.findById.mockResolvedValue(mockBooking);
      bookingService.cancelBooking.mockResolvedValue(mockCancelledBooking);

      await bookingController.cancelBooking(req, res, next);

      expect(bookingModel.findById).toHaveBeenCalledWith(123);
      expect(bookingService.cancelBooking).toHaveBeenCalledWith(
        123,
        1,
        'User_Requested'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Booking cancelled successfully',
          data: expect.objectContaining({
            bookingId: 123,
            status: 'Cancelled',
          }),
        })
      );
    });

    it('should use default cancellation reason when not provided', async () => {
      req.params = { id: '123' };
      req.body = {};

      const mockBooking = {
        bookingId: 123,
        userId: 1,
        status: 'Confirmed',
        startTime: '2025-12-20T14:00:00.000Z',
      };

      const mockCancelledBooking = {
        bookingId: 123,
        status: 'Cancelled',
        cancellationReason: 'User_Requested',
      };

      bookingModel.findById.mockResolvedValue(mockBooking);
      bookingService.cancelBooking.mockResolvedValue(mockCancelledBooking);

      await bookingController.cancelBooking(req, res, next);

      expect(bookingService.cancelBooking).toHaveBeenCalledWith(
        123,
        1,
        'User_Requested'
      );
    });

    it('should use Administrative reason for admin users', async () => {
      req.params = { id: '123' };
      req.user.role = 'Administrator';
      req.body = { reason: 'Administrative' };

      const mockBooking = {
        bookingId: 123,
        userId: 2, // Different user
        status: 'Confirmed',
        startTime: '2025-12-20T14:00:00.000Z',
      };

      const mockCancelledBooking = {
        bookingId: 123,
        status: 'Cancelled',
        cancellationReason: 'Administrative',
      };

      bookingModel.findById.mockResolvedValue(mockBooking);
      bookingService.cancelBooking.mockResolvedValue(mockCancelledBooking);

      await bookingController.cancelBooking(req, res, next);

      expect(bookingService.cancelBooking).toHaveBeenCalledWith(
        123,
        req.user.userId,
        'Administrative'
      );
    });

    it('should return 404 when booking not found', async () => {
      req.params = { id: '999' };

      bookingModel.findById.mockResolvedValue(null);

      await bookingController.cancelBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        })
      );
      expect(bookingService.cancelBooking).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not owner and not admin/space manager', async () => {
      req.params = { id: '123' };
      req.user.role = 'Student';
      req.user.userId = 2;

      const mockBooking = {
        bookingId: 123,
        userId: 1, // Different user owns this booking
      };

      bookingModel.findById.mockResolvedValue(mockBooking);

      await bookingController.cancelBooking(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN',
          }),
        })
      );
      expect(bookingService.cancelBooking).not.toHaveBeenCalled();
    });

    it('should return 400 when booking cannot be cancelled', async () => {
      req.params = { id: '123' };

      const mockBooking = {
        bookingId: 123,
        userId: 1,
        status: 'Confirmed',
        startTime: '2025-12-20T14:00:00.000Z',
      };

      const error = new Error('Cannot cancel booking within 15 minutes of start time');
      error.statusCode = 400;
      error.code = 'VALIDATION_ERROR';

      bookingModel.findById.mockResolvedValue(mockBooking);
      bookingService.cancelBooking.mockRejectedValue(error);

      await bookingController.cancelBooking(req, res, next);

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

    it('should handle errors and call next', async () => {
      req.params = { id: '123' };

      const mockBooking = {
        bookingId: 123,
        userId: 1,
        status: 'Confirmed',
      };

      bookingModel.findById.mockResolvedValue(mockBooking);
      const error = new Error('Database error');
      bookingService.cancelBooking.mockRejectedValue(error);

      await bookingController.cancelBooking(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});

describe('Validation Schemas - Booking', () => {
  describe('validateBookingRequest', () => {
    it('should validate valid booking request', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = new Date(futureDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
        purpose: 'Group study',
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing spaceId', () => {
      const data = {
        startTime: '2025-12-20T14:00:00.000Z',
        endTime: '2025-12-20T16:00:00.000Z',
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid spaceId is required');
    });

    it('should reject missing startTime', () => {
      const data = {
        spaceId: 1,
        endTime: '2025-12-20T16:00:00.000Z',
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('startTime is required');
    });

    it('should reject missing endTime', () => {
      const data = {
        spaceId: 1,
        startTime: '2025-12-20T14:00:00.000Z',
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('endTime is required');
    });

    it('should reject startTime in the past', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const endDate = new Date(pastDate.getTime() + 2 * 60 * 60 * 1000);

      const data = {
        spaceId: 1,
        startTime: pastDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('startTime must be in the future');
    });

    it('should reject startTime more than 14 days ahead', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);
      const endDate = new Date(futureDate.getTime() + 2 * 60 * 60 * 1000);

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('startTime must be within 14 days');
    });

    it('should reject endTime before startTime', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const pastEndDate = new Date(futureDate.getTime() - 1 * 60 * 60 * 1000);

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: pastEndDate.toISOString(),
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('endTime must be after startTime');
    });

    it('should reject duration less than 60 minutes', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = new Date(futureDate.getTime() + 30 * 60 * 1000); // 30 minutes

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Booking duration must be at least 60 minutes');
    });

    it('should reject duration more than 180 minutes', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = new Date(futureDate.getTime() + 200 * 60 * 1000); // 200 minutes

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Booking duration must be at most 180 minutes');
    });

    it('should accept valid duration (60-180 minutes)', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = new Date(futureDate.getTime() + 120 * 60 * 1000); // 120 minutes

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(true);
    });

    it('should reject purpose exceeding max length', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = new Date(futureDate.getTime() + 120 * 60 * 1000);

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
        purpose: 'A'.repeat(501), // Exceeds 500 characters
      };

      const result = validationSchemas.validateBookingRequest(data);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('500 characters'))).toBe(true);
    });

    it('should accept null purpose', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = new Date(futureDate.getTime() + 120 * 60 * 1000);

      const data = {
        spaceId: 1,
        startTime: futureDate.toISOString(),
        endTime: endDate.toISOString(),
        purpose: null,
      };

      const result = actualBookingService.validateBookingRequest(data);
      expect(result.valid).toBe(true);
    });
  });

  describe('validateBookingCancellation', () => {
    it('should validate valid cancellation request', () => {
      const data = {
        reason: 'User_Requested',
      };

      const result = validationSchemas.validateBookingCancellation(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept cancellation without reason', () => {
      const data = {};

      const result = validationSchemas.validateBookingCancellation(data);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid cancellation reason', () => {
      const data = {
        reason: 'Invalid_Reason',
      };

      const result = validationSchemas.validateBookingCancellation(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept valid cancellation reasons', () => {
      const validReasons = ['User_Requested', 'Administrative', 'Space_Maintenance'];

      validReasons.forEach((reason) => {
        const data = { reason };
        const result = validationSchemas.validateBookingCancellation(data);
        expect(result.valid).toBe(true);
      });
    });
  });
});
