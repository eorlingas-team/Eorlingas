const bookingModel = require('../models/bookingModel');
const pool = require('../config/db');

jest.mock('../config/db');

describe('Booking Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockJoinRow = {
        booking_id: 1, user_id: 1, space_id: 1, 
        start_time: new Date(), end_time: new Date(), 
        status: 'Confirmed', space_name: 'Room', 
        room_number: '101', building_name: 'B', 
        campus_name: 'C', email: 'u@test.com', 
        full_name: 'User', notification_preferences: {}
    };

    describe('findById', () => {
        test('should return formatted booking if found', async () => {
             pool.query.mockResolvedValue({ rows: [mockJoinRow] });
             const result = await bookingModel.findById(1);
             expect(result.bookingId).toBe(1);
        });

        test('should return null if not found', async () => {
             pool.query.mockResolvedValue({ rows: [] });
             const result = await bookingModel.findById(1);
             expect(result).toBeNull();
        });

        test('should throw error on db fail', async () => {
             pool.query.mockRejectedValue(new Error('DB Error'));
             await expect(bookingModel.findById(1)).rejects.toThrow('DB Error');
        });
    });

    describe('findByUserId', () => {
        test('should return upcoming bookings', async () => {
             pool.query.mockResolvedValue({ rows: [mockJoinRow] });
             const result = await bookingModel.findByUserId(1, { type: 'upcoming' });
             expect(result.length).toBe(1);
        });
        

        test('past bookings', async () => {
            pool.query.mockResolvedValue({ rows: [] });
            await bookingModel.findByUserId(1, { type: 'past' });
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('start_time <= NOW()'), expect.any(Array));
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.findByUserId(1)).rejects.toThrow('fail');
        });
    });

    describe('countByUserId', () => {
        test('should return count', async () => {
            pool.query.mockResolvedValue({ rows: [{ count: '5' }] });
            const count = await bookingModel.countByUserId(1, { type: 'upcoming' });
            expect(count).toBe(5);
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.countByUserId(1)).rejects.toThrow('fail');
        });
    });

    describe('findConflicts', () => {
        test('should find conflicts with locking', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findConflicts(1, new Date(), new Date(), 99, { query: pool.query });
            expect(result[0].bookingId).toBe(1);
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.findConflicts(1, new Date(), new Date())).rejects.toThrow('fail');
        });
    });

    describe('findUserOverlaps', () => {
        test('should find overlaps', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findUserOverlaps(1, new Date(), new Date());
            expect(result[0].bookingId).toBe(1);
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.findUserOverlaps(1, new Date(), new Date())).rejects.toThrow('fail');
        });
    });

    describe('create', () => {
        test('should create booking', async () => {
            pool.query.mockResolvedValue({ rows: [{ booking_id: 100 }] });
            const result = await bookingModel.create({
                userId: 1, spaceId: 1, startTime: new Date(), endTime: new Date(), confirmationNumber: 'abc'
            });
            expect(result.bookingId).toBe(100);
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.create({})).rejects.toThrow('fail');
        });
    });

    describe('updateStatus', () => {
        test('should update', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.updateStatus(1, 'Cancelled', 'Reason');
            expect(result.bookingId).toBe(1);
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.updateStatus(1, 'status')).rejects.toThrow('fail');
        });
    });

    describe('confirmationNumberExists', () => {
        test('exists', async () => {
            pool.query.mockResolvedValue({ rows: [1] });
            expect(await bookingModel.confirmationNumberExists('a')).toBe(true);
        });

        test('db fail', async () => {
            pool.query.mockRejectedValue(new Error('fail'));
            await expect(bookingModel.confirmationNumberExists('a')).rejects.toThrow('fail');
        });
    });

    describe('Join Queries', () => {
        test('findByIdWithSpace', async () => {
             pool.query.mockResolvedValue({ rows: [mockJoinRow] });
             const result = await bookingModel.findByIdWithSpace(1);
             expect(result.space.spaceName).toBe('Room');
        });

        test('findByUserIdWithSpace with limit and offset', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            await bookingModel.findByUserIdWithSpace(1, { limit: 10, offset: 5 });
            expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT $2 OFFSET $3'), [1, 10, 5]);
        });

        test('findActiveAtTime returns null if no rows', async () => {
            pool.query.mockResolvedValue({ rows: [] });
            const result = await bookingModel.findActiveAtTime(1, new Date());
            expect(result).toBeNull();
        });

        test('findByUserIdWithSpace with filter', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findByUserIdWithSpace(1, { type: 'upcoming' });
            expect(result[0].space.spaceName).toBe('Room');
        });

        test('findUpcomingBySpaceIdWithUser', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findUpcomingBySpaceIdWithUser(1);
            expect(result[0].user.fullName).toBe('User');
        });

        test('findOverlappingBySpaceIdWithUser', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findOverlappingBySpaceIdWithUser(1, new Date(), new Date());
            expect(result[0].user.fullName).toBe('User');
        });

        test('findFutureBySpaceIdWithUser', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findFutureBySpaceIdWithUser(1, new Date());
            expect(result[0].user.fullName).toBe('User');
        });

        test('findBySpaceAndTime', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findBySpaceAndTime(1, new Date(), new Date());
            expect(result[0].user.fullName).toBe('User');
        });

        test('findActiveAtTime', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findActiveAtTime(1, new Date());
            expect(result.user.fullName).toBe('User');
        });

        test('countActiveBookings', async () => {
            pool.query.mockResolvedValue({ rows: [{ count: 5 }] });
            expect(await bookingModel.countActiveBookings(1)).toBe(5);
        });
        
        test('findUpcomingByUserId', async () => {
            pool.query.mockResolvedValue({ rows: [] });
            await bookingModel.findUpcomingByUserId(1);
            expect(pool.query).toHaveBeenCalled();
        });
    });

    describe('Reminders', () => {
        test('findBookingsNeedingReminder should map rows', async () => {
            pool.query.mockResolvedValue({ rows: [mockJoinRow] });
            const result = await bookingModel.findBookingsNeedingReminder(60);
            expect(result[0].user.email).toBe('u@test.com');
            expect(result[0].space.spaceName).toBe('Room');
        });

        test('markReminderSent', async () => {
            pool.query.mockResolvedValue({});
            await bookingModel.markReminderSent(1);
            expect(pool.query).toHaveBeenCalled();
        });
    });

    describe('Error Handling Catch Blocks', () => {
        const methodsToTest = [
            'findByIdWithSpace', 'findByUserIdWithSpace', 'findUpcomingBySpaceIdWithUser',
            'findOverlappingBySpaceIdWithUser', 'findFutureBySpaceIdWithUser', 'findBySpaceAndTime',
            'findActiveAtTime', 'findBookingsNeedingReminder', 'markReminderSent', 'findUpcomingByUserId',
            'countActiveBookings'
        ];

        methodsToTest.forEach(method => {
            test(`${method} should throw on DB error`, async () => {
                pool.query.mockRejectedValue(new Error('fail'));
                if (method === 'markReminderSent' || method === 'findUpcomingByUserId') {
                    await expect(bookingModel[method](1)).rejects.toThrow('fail');
                } else if (method === 'findOverlappingBySpaceIdWithUser' || method === 'findBySpaceAndTime') {
                    await expect(bookingModel[method](1, new Date(), new Date())).rejects.toThrow('fail');
                } else {
                    await expect(bookingModel[method](1)).rejects.toThrow('fail');
                }
            });
        });
    });
});
