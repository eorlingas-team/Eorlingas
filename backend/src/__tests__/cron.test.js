const request = require('supertest');
const app = require('../app');
const bookingModel = require('../models/bookingModel');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

// Mock dependencies
jest.mock('../models/bookingModel');
jest.mock('../services/emailService');
jest.mock('../services/notificationService');
// Mock audit logger if imported by app/routes implicitly, though not used in cronController strictly
jest.mock('../utils/auditLogger'); 

describe('Cron API Unit Tests', () => {
  const validSecret = 'EorlingasCronSecret2025'; // Default fallback
  
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('ALL /api/cron/reminders', () => {
    it('should return 401 if secret is invalid', async () => {
      const res = await request(app).get('/api/cron/reminders?secret=wrong');
      
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized: Invalid cron secret');
    });

    it('should return 401 if secret is missing', async () => {
        const res = await request(app).get('/api/cron/reminders');
        
        expect(res.statusCode).toBe(401);
      });

    it('should process bookings successfully', async () => {
      const mockBookings = [
        {
          bookingId: 1,
          userId: 10,
          user: { email: 'user@example.com', fullName: 'Test User' },
          space: { spaceName: 'Library Room' }
        }
      ];

      bookingModel.findBookingsNeedingReminder.mockResolvedValue(mockBookings);
      emailService.sendBookingReminderEmail.mockResolvedValue(true);
      notificationService.createNotification.mockResolvedValue(true);
      bookingModel.markReminderSent.mockResolvedValue(true);

      const res = await request(app).get(`/api/cron/reminders?secret=${validSecret}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats.totalFound).toBe(1);
      expect(res.body.stats.sent).toBe(1);
      expect(res.body.stats.errors).toBe(0);

      expect(bookingModel.findBookingsNeedingReminder).toHaveBeenCalled();
      expect(emailService.sendBookingReminderEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@example.com'
      }));
      expect(notificationService.createNotification).toHaveBeenCalled();
      expect(bookingModel.markReminderSent).toHaveBeenCalledWith(1);
    });

    it('should handle errors for individual bookings gracefully', async () => {
        const mockBookings = [
          {
            bookingId: 1,
            userId: 10,
            user: { email: 'pass@example.com', fullName: 'Pass User' },
            space: { spaceName: 'Room A' }
          },
          {
            bookingId: 2,
            userId: 11,
            user: { email: 'fail@example.com', fullName: 'Fail User' },
            space: { spaceName: 'Room B' }
          }
        ];
  
        bookingModel.findBookingsNeedingReminder.mockResolvedValue(mockBookings);
        
        // First succeeds
        emailService.sendBookingReminderEmail.mockResolvedValueOnce(true);
        notificationService.createNotification.mockResolvedValueOnce(true);
        bookingModel.markReminderSent.mockResolvedValueOnce(true);

        // Second fails at email step
        emailService.sendBookingReminderEmail.mockRejectedValueOnce(new Error('Email failed'));
  
        const res = await request(app).get(`/api/cron/reminders?secret=${validSecret}`);
  
        expect(res.statusCode).toBe(200);
        expect(res.body.stats.totalFound).toBe(2);
        expect(res.body.stats.sent).toBe(1);
        expect(res.body.stats.errors).toBe(1);
      });

      it('should return 500 on fatal error', async () => {
        bookingModel.findBookingsNeedingReminder.mockRejectedValue(new Error('DB Connection Failed'));

        const res = await request(app).get(`/api/cron/reminders?secret=${validSecret}`);

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toBe('Internal server error');
      });

      describe('Environment Configuration', () => {
        it('should use configured cron secret', async () => {
          process.env.CRON_SECRET = 'CustomSecret123';
          
          bookingModel.findBookingsNeedingReminder.mockResolvedValue([]);
          const res = await request(app).get('/api/cron/reminders?secret=CustomSecret123');
          expect(res.statusCode).toBe(200);
        });

        it('should use configured reminder interval', async () => {
          process.env.REMINDER_INTERVAL_MINUTES = '99';
          bookingModel.findBookingsNeedingReminder.mockResolvedValue([]);
          
          // Use default secret since CRON_SECRET is reset by beforeEach/oldEnv if not set
          // Wait, logic: reset to OLD_ENV which likely has no CRON_SECRET.
          // So default fallback 'EorlingasCronSecret2025' applies.
          await request(app).get('/api/cron/reminders?secret=EorlingasCronSecret2025');
          expect(bookingModel.findBookingsNeedingReminder).toHaveBeenCalledWith(99);
        });

        it('should use default reminder interval when env var is missing', async () => {
          delete process.env.REMINDER_INTERVAL_MINUTES;
          bookingModel.findBookingsNeedingReminder.mockResolvedValue([]);
          
          await request(app).get('/api/cron/reminders?secret=EorlingasCronSecret2025');
          expect(bookingModel.findBookingsNeedingReminder).toHaveBeenCalledWith(70);
        });

        it('should use default cron secret when env var is missing', async () => {
            delete process.env.CRON_SECRET;
            bookingModel.findBookingsNeedingReminder.mockResolvedValue([]);
            
            const res = await request(app).get('/api/cron/reminders?secret=EorlingasCronSecret2025');
            expect(res.statusCode).toBe(200);
        });
      });
  });
});
