const reportModel = require('../models/reportModel');
const pool = require('../config/db');

jest.mock('../config/db');

describe('Report Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        test('should create report with token', async () => {
             const mockRow = { report_id: 1, defense_token: 'abc' };
             pool.query.mockResolvedValue({ rows: [mockRow] });
             
             const data = { bookingId: 1, reporterUserId: 2, reportedUserId: 3, spaceId: 4, message: 'msg' };
             const result = await reportModel.create(data);
             
             expect(result.reportId).toBe(1);
             expect(result.defenseToken).toBe('abc');
        });
        
        test('should throw error on fail', async () => {
             pool.query.mockRejectedValue(new Error('DB Fail'));
             await expect(reportModel.create({})).rejects.toThrow('DB Fail');
        });
    });

    describe('findById', () => {
        test('should return report with details', async () => {
             const mockRow = { report_id: 1, reporter_full_name: 'John', space_name: 'Room' };
             pool.query.mockResolvedValue({ rows: [mockRow] });
             
             const result = await reportModel.findById(1);
             expect(result.reporter.fullName).toBe('John');
             expect(result.space.spaceName).toBe('Room');
        });

        test('should return null if not found', async () => {
             pool.query.mockResolvedValue({ rows: [] });
             const result = await reportModel.findById(1);
             expect(result).toBeNull();
        });
    });

    describe('findAll', () => {
        test('should return all reports', async () => {
             pool.query.mockResolvedValue({ rows: [] });
             await reportModel.findAll();
             expect(pool.query).toHaveBeenCalled();
        });

        test('should filter by status', async () => {
             pool.query.mockResolvedValue({ rows: [] });
             await reportModel.findAll({ status: 'Pending' });
             expect(pool.query).toHaveBeenCalledWith(
                 expect.stringContaining('status = $1'),
                 ['Pending']
             );
        });
    });

    describe('updateStatus', () => {
        test('should update status', async () => {
             pool.query.mockResolvedValue({ rows: [{ report_id: 1, status: 'Reviewed' }] });
             const result = await reportModel.updateStatus(1, 'Reviewed', 1, 'Note');
             expect(result.status).toBe('Reviewed');
        });
    });

    describe('countTodayByReporter', () => {
        test('should return count', async () => {
             pool.query.mockResolvedValue({ rows: [{ count: '2' }] });
             const count = await reportModel.countTodayByReporter(1);
             expect(count).toBe(2);
        });
    });
    
    describe('countMonthlyAgainstUser', () => {
        test('should return count', async () => {
             pool.query.mockResolvedValue({ rows: [{ count: '3' }] });
             const count = await reportModel.countMonthlyAgainstUser(1, 2);
             expect(count).toBe(3);
        });
    });

    describe('findByDefenseToken', () => {
         test('should find report', async () => {
             pool.query.mockResolvedValue({ rows: [{ report_id: 1 }] });
             const result = await reportModel.findByDefenseToken('abc');
             expect(result.reportId).toBe(1);
         });
    });

    describe('updateDefense', () => {
         test('should update defense', async () => {
             pool.query.mockResolvedValue({ rows: [{ report_id: 1, defense_message: 'msg' }] });
             const result = await reportModel.updateDefense(1, 'msg');
             expect(result.defenseMessage).toBe('msg');
         });
    });

    describe('Statistical Queries', () => {
         test('getReportedUserStats should return stats', async () => {
             pool.query
                 .mockResolvedValueOnce({ rows: [{ count: 10 }] }) // bookings
                 .mockResolvedValueOnce({ rows: [{ count: 2 }] }); // reports
             
             const stats = await reportModel.getReportedUserStats(1);
             expect(stats.totalBookings).toBe(10);
             expect(stats.totalReportsReceived).toBe(2);
         });

         test('countPending should return count', async () => {
             pool.query.mockResolvedValue({ rows: [{ count: 5 }] });
             const count = await reportModel.countPending();
             expect(count).toBe(5);
         });
    });

    describe('Error Handling', () => {
        test('getReportedUserStats throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.getReportedUserStats(1)).rejects.toThrow('Fail');
        });

        test('countPending throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.countPending()).rejects.toThrow('Fail');
        });

        test('updateStatus throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.updateStatus(1, 'Reviewed', 1)).rejects.toThrow('Fail');
        });

        test('findById throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.findById(1)).rejects.toThrow('Fail');
        });

        test('findAll throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.findAll()).rejects.toThrow('Fail');
        });

        test('findByDefenseToken throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.findByDefenseToken('abc')).rejects.toThrow('Fail');
        });

        test('updateDefense throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.updateDefense(1, 'msg')).rejects.toThrow('Fail');
        });

        test('countTodayByReporter throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.countTodayByReporter(1)).rejects.toThrow('Fail');
        });

        test('countMonthlyAgainstUser throws', async () => {
            pool.query.mockRejectedValue(new Error('Fail'));
            await expect(reportModel.countMonthlyAgainstUser(1, 2)).rejects.toThrow('Fail');
        });
    });
});
