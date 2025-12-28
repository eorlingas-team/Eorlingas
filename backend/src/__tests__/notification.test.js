const request = require('supertest');
const app = require('../app');
const notificationService = require('../services/notificationService');
const { verifyAccessToken } = require('../utils/jwtUtils');
const userModel = require('../models/userModel');

// Mock dependencies
jest.mock('../services/notificationService');
jest.mock('../models/userModel');
jest.mock('../utils/jwtUtils');
jest.mock('../utils/auditLogger');

describe('Notification API Unit Tests', () => {
  const mockUserId = 1;
  const mockUserRole = 'Student';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default auth mock
    verifyAccessToken.mockReturnValue({
      userId: mockUserId,
      role: mockUserRole,
      iat: 1234567890,
      exp: 1234567890 + 3600
    });

    userModel.findById.mockResolvedValue({
      user_id: mockUserId,
      role: mockUserRole,
      status: 'Active'
    });
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications successfully', async () => {
      const mockResult = {
        notifications: [
          {
            id: 1,
            userId: mockUserId,
            type: 'BOOKING_CONFIRMED',
            subject: 'Booking Confirmed',
            message: 'Your booking is confirmed',
            isRead: false,
            createdAt: '2025-12-25T10:00:00Z'
          }
        ],
        unreadCount: 1,
        pagination: { limit: 20, offset: 0 }
      };

      notificationService.getUserNotifications.mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(notificationService.getUserNotifications).toHaveBeenCalledWith(mockUserId, expect.any(Object));
    });

    it('should handle service errors', async () => {
      notificationService.getUserNotifications.mockRejectedValue(new Error('Database error'));

      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count successfully', async () => {
      const mockResult = { unreadCount: 5 };
      notificationService.getUnreadCount.mockResolvedValue(mockResult);

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle service errors', async () => {
      notificationService.getUnreadCount.mockRejectedValue(new Error('DB Error'));

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    it('should mark notification as read successfully', async () => {
      const notificationId = 123;
      const mockNotification = { id: notificationId, isRead: true };
      
      notificationService.markAsRead.mockResolvedValue(mockNotification);

      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.notification).toEqual(mockNotification);
      expect(notificationService.markAsRead).toHaveBeenCalledWith(notificationId, mockUserId);
    });

    it('should return 404 if notification not found or not owned by user', async () => {
      notificationService.markAsRead.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/notifications/999/read')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should handle service errors', async () => {
      notificationService.markAsRead.mockRejectedValue(new Error('DB Error'));

      const res = await request(app)
        .put('/api/notifications/123/read')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read successfully', async () => {
      notificationService.markAllAsRead.mockResolvedValue({ success: true });

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(notificationService.markAllAsRead).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle service errors', async () => {
      notificationService.markAllAsRead.mockRejectedValue(new Error('DB Error'));

      const res = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', 'Bearer valid-token');

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
