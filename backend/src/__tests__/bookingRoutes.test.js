const request = require('supertest');
const express = require('express');

// Mock the dependencies before requiring the routes
jest.mock('../middleware/authMiddleware', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { userId: 1, role: 'Student' };
    next();
  })
}));

jest.mock('../middleware/authorizationMiddleware', () => ({
  requireStudent: jest.fn((req, res, next) => next())
}));

jest.mock('../controllers/bookingController', () => ({
  createBooking: jest.fn((req, res) => res.status(201).json({ success: true, data: { bookingId: 1 } })),
  getUserBookings: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getBookingById: jest.fn((req, res) => res.status(200).json({ success: true, data: { bookingId: req.params.id } })),
  cancelBooking: jest.fn((req, res) => res.status(200).json({ success: true, data: { status: 'Cancelled' } }))
}));

const bookingRoutes = require('../routes/bookingRoutes');
const bookingController = require('../controllers/bookingController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/authorizationMiddleware');

// Create express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', bookingRoutes);
  return app;
};

describe('Booking Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe('POST /api/bookings', () => {
    const now = new Date();
    const futureStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 90 * 60 * 1000);

    const validBookingData = {
      spaceId: 1,
      startTime: futureStart.toISOString(),
      endTime: futureEnd.toISOString(),
      attendeeCount: 2
    };

    test('should create booking with valid data', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .send(validBookingData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(authenticate).toHaveBeenCalled();
      expect(requireStudent).toHaveBeenCalled();
      expect(bookingController.createBooking).toHaveBeenCalled();
    });

    test('should return 400 if spaceId is missing', async () => {
      const invalidData = { ...validBookingData };
      delete invalidData.spaceId;

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('spaceId');
    });

    test('should return 400 if startTime is missing', async () => {
      const invalidData = { ...validBookingData };
      delete invalidData.startTime;

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('startTime');
    });

    test('should return 400 if endTime is missing', async () => {
      const invalidData = { ...validBookingData };
      delete invalidData.endTime;

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('endTime');
    });

    test('should return 400 if endTime is before startTime', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: futureEnd.toISOString(),
        endTime: futureStart.toISOString()
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('greater than');
    });

    test('should return 400 if attendeeCount is invalid (zero)', async () => {
      const invalidData = {
        ...validBookingData,
        attendeeCount: 0
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('attendeeCount');
    });

    test('should return 400 if attendeeCount is negative', async () => {
      const invalidData = {
        ...validBookingData,
        attendeeCount: -1
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('attendeeCount');
    });

    test('should return 400 if startTime format is invalid', async () => {
      const invalidData = {
        ...validBookingData,
        startTime: 'not-a-date'
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('startTime');
    });

    test('should return 400 if spaceId is not a number', async () => {
      const invalidData = {
        ...validBookingData,
        spaceId: 'abc'
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('spaceId');
    });

    test('should pass valid booking with purpose', async () => {
      const dataWithPurpose = {
        ...validBookingData,
        purpose: 'Group study session'
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(dataWithPurpose);

      expect(response.status).toBe(201);
      expect(bookingController.createBooking).toHaveBeenCalled();
    });

    test('should pass valid booking without attendeeCount', async () => {
      const { attendeeCount, ...dataWithoutAttendee } = validBookingData;

      const response = await request(app)
        .post('/api/bookings')
        .send(dataWithoutAttendee);

      expect(response.status).toBe(201);
      expect(bookingController.createBooking).toHaveBeenCalled();
    });
  });

  describe('GET /api/bookings', () => {
    test('should get user bookings', async () => {
      const response = await request(app)
        .get('/api/bookings');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(authenticate).toHaveBeenCalled();
      expect(bookingController.getUserBookings).toHaveBeenCalled();
    });
  });

  describe('GET /api/bookings/:id', () => {
    test('should get booking by id', async () => {
      const response = await request(app)
        .get('/api/bookings/123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(authenticate).toHaveBeenCalled();
      expect(bookingController.getBookingById).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    test('should cancel booking', async () => {
      const response = await request(app)
        .delete('/api/bookings/123')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(authenticate).toHaveBeenCalled();
      expect(bookingController.cancelBooking).toHaveBeenCalled();
    });

    test('should cancel with User_Requested reason', async () => {
      const response = await request(app)
        .delete('/api/bookings/123')
        .send({ reason: 'User_Requested' });

      expect(response.status).toBe(200);
      expect(bookingController.cancelBooking).toHaveBeenCalled();
    });

    test('should cancel with Administrative reason', async () => {
      const response = await request(app)
        .delete('/api/bookings/123')
        .send({ reason: 'Administrative' });

      expect(response.status).toBe(200);
      expect(bookingController.cancelBooking).toHaveBeenCalled();
    });

    test('should cancel with Space_Maintenance reason', async () => {
      const response = await request(app)
        .delete('/api/bookings/123')
        .send({ reason: 'Space_Maintenance' });

      expect(response.status).toBe(200);
      expect(bookingController.cancelBooking).toHaveBeenCalled();
    });

    test('should return 400 if invalid reason provided', async () => {
      const response = await request(app)
        .delete('/api/bookings/123')
        .send({ reason: 'INVALID_REASON' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
