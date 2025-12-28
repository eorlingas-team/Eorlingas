const reportService = require('../services/reportService');
const reportModel = require('../models/reportModel');
const bookingModel = require('../models/bookingModel');
const userModel = require('../models/userModel');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');

jest.mock('../models/reportModel');
jest.mock('../models/bookingModel');
jest.mock('../models/userModel');
jest.mock('../services/emailService');
jest.mock('../services/notificationService');

describe('Report Service', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        emailService.sendReportNotificationEmail.mockResolvedValue({});
        notificationService.createNotification.mockResolvedValue({});
    });

    describe('createReport', () => {
        const mockReporterId = 1;
        const mockReportData = {
            spaceId: 10,
            reportTime: '2025-01-01T10:00:00Z',
            message: 'Noise'
        };

        test('should enforce daily limit', async () => {
             reportModel.countTodayByReporter.mockResolvedValue(3);
             await expect(reportService.createReport(mockReporterId, mockReportData))
                 .rejects.toThrow('Daily report limit reached');
        });

        test('should fail if no booking found', async () => {
             reportModel.countTodayByReporter.mockResolvedValue(0);
             bookingModel.findActiveAtTime.mockResolvedValue(null);
             
             await expect(reportService.createReport(mockReporterId, mockReportData))
                 .rejects.toThrow('No active booking found');
        });

        test('should fail on self-report', async () => {
             reportModel.countTodayByReporter.mockResolvedValue(0);
             bookingModel.findActiveAtTime.mockResolvedValue({ userId: mockReporterId });
             
             await expect(reportService.createReport(mockReporterId, mockReportData))
                 .rejects.toThrow('cannot report your own booking');
        });

        test('should fail if monthly limit reached', async () => {
             reportModel.countTodayByReporter.mockResolvedValue(0);
             bookingModel.findActiveAtTime.mockResolvedValue({ userId: 2, bookingId: 100 });
             reportModel.countMonthlyAgainstUser.mockResolvedValue(3);
             
             await expect(reportService.createReport(mockReporterId, mockReportData))
                 .rejects.toThrow('Monthly report limit');
        });

        test('should create report even if notification fails', async () => {
             reportModel.countTodayByReporter.mockResolvedValue(0);
             bookingModel.findActiveAtTime.mockResolvedValue({ 
                 userId: 2, bookingId: 100, user: { email: 'target@test.com', fullName: 'Target' } 
             });
             reportModel.countMonthlyAgainstUser.mockResolvedValue(0);
             reportModel.create.mockResolvedValue({ reportId: 50, defenseToken: 'abc' });
             
             notificationService.createNotification.mockRejectedValue(new Error('Push Fail'));
             // emailService already mocked to resolve or reject doesn't matter as it's caught
             
             const result = await reportService.createReport(mockReporterId, mockReportData);
             expect(result.reportId).toBe(50);
        });

        test('should create report successfully', async () => {
             reportModel.countTodayByReporter.mockResolvedValue(0);
             bookingModel.findActiveAtTime.mockResolvedValue({ 
                 userId: 2, bookingId: 100, user: { email: 'target@test.com', fullName: 'Target' } 
             });
             reportModel.countMonthlyAgainstUser.mockResolvedValue(0);
             
             reportModel.create.mockResolvedValue({ reportId: 50, defenseToken: 'abc' });
             
             const result = await reportService.createReport(mockReporterId, mockReportData);
             
             expect(result.reportId).toBe(50);
             expect(emailService.sendReportNotificationEmail).toHaveBeenCalled();
             expect(notificationService.createNotification).toHaveBeenCalled();
        });
    });

    describe('submitDefense', () => {
         test('should fail if token invalid', async () => {
             reportModel.findByDefenseToken.mockResolvedValue(null);
             await expect(reportService.submitDefense('bad', 'msg')).rejects.toThrow('Invalid or expired');
         });

         test('should fail if already submitted', async () => {
             reportModel.findByDefenseToken.mockResolvedValue({ defenseMessage: 'Existing' });
             await expect(reportService.submitDefense('good', 'msg')).rejects.toThrow('already submitted');
         });

         test('should submit defense successfully', async () => {
             reportModel.findByDefenseToken.mockResolvedValue({ reportId: 1, defenseMessage: null });
             reportModel.updateDefense.mockResolvedValue({ reportId: 1, defenseMessage: 'msg' });
             
             const result = await reportService.submitDefense('good', 'msg');
             expect(result.defenseMessage).toBe('msg');
         });
    });

    describe('Retrieval and Utility Methods', () => {
         test('getAllReports delegates to model', async () => {
             reportModel.findAll.mockResolvedValue([]);
             const res = await reportService.getAllReports({});
             expect(res).toEqual([]);
             expect(reportModel.findAll).toHaveBeenCalled();
         });

         test('getReportById delegates to model', async () => {
             reportModel.findById.mockResolvedValue({ id: 1 });
             const res = await reportService.getReportById(1);
             expect(res).toEqual({ id: 1 });
         });

         test('getReportedUserStats delegates to model', async () => {
             reportModel.getReportedUserStats.mockResolvedValue({});
             const res = await reportService.getReportedUserStats(1);
             expect(res).toEqual({});
         });

         test('getPendingReportsCount delegates to model', async () => {
             reportModel.countPending.mockResolvedValue(5);
             const res = await reportService.getPendingReportsCount();
             expect(res).toBe(5);
         });

         test('markAsReviewed success', async () => {
             reportModel.findById.mockResolvedValue({ id: 1 });
             reportModel.updateStatus.mockResolvedValue({ id: 1, status: 'Reviewed' });
             
             const res = await reportService.markAsReviewed(1, 1, 'notes');
             expect(res.status).toBe('Reviewed');
         });

         test('markAsReviewed fail if not found', async () => {
             reportModel.findById.mockResolvedValue(null);
             await expect(reportService.markAsReviewed(1, 1)).rejects.toThrow('Report not found');
         });
    });
});
