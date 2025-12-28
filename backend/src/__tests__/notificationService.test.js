const notificationService = require('../services/notificationService');
const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');

jest.mock('../models/notificationModel');
jest.mock('../models/userModel');

describe('Notification Service', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('createNotification', () => {
        const mockUserId = 1;
        const mockData = { subject: 'Hy', message: 'Hello' };

        test('should return null if user not found', async () => {
             userModel.findById.mockResolvedValue(null);
             const result = await notificationService.createNotification(mockUserId, 'Type', mockData);
             expect(result).toBeNull();
             expect(notificationModel.create).not.toHaveBeenCalled();
        });

        test('should return null if web notifications disabled', async () => {
             userModel.findById.mockResolvedValue({ notification_preferences: { webNotifications: false } });
             const result = await notificationService.createNotification(mockUserId, 'Type', mockData);
             expect(result).toBeNull();
             expect(notificationModel.create).not.toHaveBeenCalled();
        });

        test('should create notification if preferences allowed (default)', async () => {
             userModel.findById.mockResolvedValue({ notification_preferences: {} }); // Default true
             notificationModel.create.mockResolvedValue({ id: 10 });
             
             const result = await notificationService.createNotification(mockUserId, 'Type', mockData);
             expect(result).toEqual({ id: 10 });
        });

        test('should handle db error gracefully', async () => {
             userModel.findById.mockResolvedValue({ notification_preferences: {} });
             notificationModel.create.mockRejectedValue(new Error('DB Fail'));
             
             // Check console error spy? Or just ensure it doesn't throw
             const result = await notificationService.createNotification(mockUserId, 'Type', mockData);
             expect(result).toBeNull();
        });
    });

    describe('Retrieval Methods', () => {
         test('getUserNotifications delegates to model', async () => {
             notificationModel.findByUserId.mockResolvedValue([]);
             notificationModel.countUnread.mockResolvedValue(0);
             
             await notificationService.getUserNotifications(1, { limit: 10, offset: 0 });
             expect(notificationModel.findByUserId).toHaveBeenCalled();
         });

         test('markAsRead delegaties to model', async () => {
             notificationModel.markAsRead.mockResolvedValue({ id: 1, isRead: true });
             const res = await notificationService.markAsRead(1, 1);
             expect(res).toEqual({ id: 1, isRead: true });
             expect(notificationModel.markAsRead).toHaveBeenCalledWith(1, 1);
         });

         test('markAllAsRead delegates to model', async () => {
             notificationModel.markAllAsRead.mockResolvedValue();
             const res = await notificationService.markAllAsRead(1);
             expect(res).toEqual({ success: true });
             expect(notificationModel.markAllAsRead).toHaveBeenCalledWith(1);
         });

         test('getUnreadCount delegaties to model', async () => {
             notificationModel.countUnread.mockResolvedValue(5);
             const res = await notificationService.getUnreadCount(1);
             expect(res).toEqual({ unreadCount: 5 });
             expect(notificationModel.countUnread).toHaveBeenCalledWith(1);
         });
    });
});
