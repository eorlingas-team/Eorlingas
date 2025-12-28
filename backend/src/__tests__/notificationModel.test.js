const notificationModel = require('../models/notificationModel');
const pool = require('../config/db');

jest.mock('../config/db');

describe('Notification Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        test('should create notification', async () => {
            const mockRow = { notification_id: 1, user_id: 1, message: 'msg' };
            pool.query.mockResolvedValue({ rows: [mockRow] });

            const data = { userId: 1, type: 'Info', message: 'msg' };
            const result = await notificationModel.create(data);
            
            expect(result.notificationId).toBe(1);
            expect(pool.query).toHaveBeenCalled();
        });
    });

    describe('findByUserId', () => {
        test('should return notifications', async () => {
             pool.query.mockResolvedValue({ rows: [] });
             await notificationModel.findByUserId(1);
             expect(pool.query).toHaveBeenCalledWith(
                 expect.stringContaining('LIMIT $2 OFFSET $3'),
                 [1, 50, 0]
             );
        });
    });

    describe('countUnread', () => {
        test('should return count', async () => {
             pool.query.mockResolvedValue({ rows: [{ count: '5' }] });
             const count = await notificationModel.countUnread(1);
             expect(count).toBe(5);
        });
    });

    describe('markAsRead', () => {
        test('should mark as read', async () => {
             pool.query.mockResolvedValue({ rows: [{ notification_id: 1, is_read: true }] });
             const result = await notificationModel.markAsRead(1, 1);
             expect(result.isRead).toBe(true);
        });
        
        test('should return null if not found', async () => {
             pool.query.mockResolvedValue({ rows: [] });
             const result = await notificationModel.markAsRead(1, 1);
             expect(result).toBeNull();
        });
    });

    describe('markAllAsRead', () => {
        test('should update all', async () => {
             pool.query.mockResolvedValue({ rowCount: 5 });
             await notificationModel.markAllAsRead(1);
             expect(pool.query).toHaveBeenCalledWith(
                 expect.stringContaining('is_read = TRUE'),
                 [1]
             );
        });
    });
});
