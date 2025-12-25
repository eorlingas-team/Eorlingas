const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');
const userModel = require('../models/userModel');
const { verifyAccessToken } = require('../utils/jwtUtils');



const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};


jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(() => mockClient),
}));

jest.mock('../models/userModel', () => ({
  findById: jest.fn(),
  update: jest.fn()
}));

jest.mock('../models/bookingModel', () => ({
  findUpcomingByUserId: jest.fn(),
  findUpcomingBySpaceIdWithUser: jest.fn(),
  findByIdWithSpace: jest.fn(),
  findFutureBySpaceIdWithUser: jest.fn()
}));

jest.mock('../utils/jwtUtils', () => ({ verifyAccessToken: jest.fn() }));

jest.mock('../services/emailService', () => ({
  sendAccountSuspensionEmail: jest.fn().mockResolvedValue({}),
  sendBookingCancellationEmail: jest.fn().mockResolvedValue({}),
  sendAccountRecoveryEmail: jest.fn().mockResolvedValue({})
}));

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({})
}));

describe('Administrative API Tests (Comprehensive)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
  });



  it('should return system stats for Administrator', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    // Mock 6 queries used in getSystemStats
    pool.query
      .mockResolvedValueOnce({ rows: [{ total_users: '100', active_users: '90', new_users_period: '5' }] }) // userStats
      .mockResolvedValueOnce({ rows: [{ total_spaces: '10', available_spaces: '8' }] }) // spaceStats
      .mockResolvedValueOnce({ rows: [{ total_bookings: '500', active_bookings_snapshot: '50', confirmed_bookings: '400', cancelled_bookings: '100' }] }) // bookingStats
      .mockResolvedValueOnce({ rows: [{ completed: '300', upcoming: '100', cancelled: '100' }] }) // bookingBreakdownResult
      .mockResolvedValueOnce({ rows: [{ hour: '10', booking_count: '25' }] }) // peakHoursResult
      .mockResolvedValueOnce({ rows: [{ space_name: 'Room A', building_name: 'B1', booking_count: '50' }] }); // mostBookedResult

    const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.statistics.activeUsers).toBe(90);
    expect(res.body.data.statistics.totalSpaces).toBe(10);
  });

  it('should deny access to non-admin users (Student)', async () => {
    verifyAccessToken.mockReturnValue({ userId: 2, role: 'Student' });
    userModel.findById.mockResolvedValue({ user_id: 2, role: 'Student', status: 'Verified' });

    const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
    expect(res.statusCode).toBe(403);
  });

  it('should list users with pagination', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    const mockUserList = [{ user_id: 2, full_name: 'Test Student', role: 'Student' }];
    
    pool.query
      .mockResolvedValueOnce({ rows: mockUserList })    
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); 

    const res = await request(app).get('/api/admin/users?page=1&limit=10').set('Authorization', 'Bearer token');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.users.length).toBe(1);
  });

  it('should suspend a user successfully', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    const updatedUser = { user_id: 5, status: 'Suspended', full_name: 'Test Student', email: 'test@itu.edu.tr' };
    userModel.update.mockResolvedValue(updatedUser);
    
    const bookingModel = require('../models/bookingModel');
    bookingModel.findUpcomingByUserId.mockResolvedValue([]);
    
    pool.query.mockResolvedValue({ rows: [], rowCount: 1 });

    const res = await request(app)
      .put('/api/admin/users/5')
      .set('Authorization', 'Bearer token')
      .send({ action: 'suspend', params: { reason: 'Test' } });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.user.status).toBe('Suspended');
  });



  it('should create a space (Admin)', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    // Mock pool.query for:
    // 1. UNIQUE room check
    pool.query.mockResolvedValueOnce({ rows: [] });
    // 2. INSERT space
    const mockCreatedSpace = {
      space_id: 1,
      space_name: 'New Room',
      room_number: '101',
      building_id: 1,
      status: 'Available'
    };
    pool.query.mockResolvedValueOnce({ rows: [mockCreatedSpace] });
    // 3. Audit log insert is also a pool.query in controllers
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post('/api/spaces') // Adjusted route from /api/admin/spaces to /api/spaces
      .set('Authorization', 'Bearer token')
      .send({
        buildingId: 1,
        spaceName: 'New Room',
        roomNumber: '101',
        capacity: 10,
        roomType: 'Study_Room'
      });

    if (res.statusCode !== 201) {
      console.log('Create Space Error Body:', res.body);
    }

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should update status to Maintenance', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    const bookingModel = require('../models/bookingModel');
    bookingModel.findFutureBySpaceIdWithUser.mockResolvedValue([]);

    // 1. SELECT current space (uses mockClient.query due to transaction)
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Available', building_id: 1, room_number: '101', capacity: 10 }] })
      .mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Maintenance' }] }) // UPDATE Space Status
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    pool.query.mockResolvedValue({ rowCount: 1 }); // Audit log

    const res = await request(app)
      .put('/api/spaces/1')
      .set('Authorization', 'Bearer token')
      .send({
        status: 'Maintenance'
      });
    
    if (res.statusCode !== 200) console.log('Update Status Error:', res.body);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('Maintenance');
  });

  it('should soft delete space', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    const bookingModel = require('../models/bookingModel');
    bookingModel.findUpcomingBySpaceIdWithUser.mockResolvedValue([]);

    // deleteSpace uses client.query
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Deleted' }] }) // SELECT/UPDATE Space
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    pool.query.mockResolvedValue({ rowCount: 1 }); // Audit log

    const res = await request(app)
      .delete('/api/spaces/1')
      .set('Authorization', 'Bearer token')
      .send({});
    
    if (res.statusCode !== 200) console.log('Delete Space Error:', res.body);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('Deleted');
  });



  it('should list audit logs (Admin)', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    
    const mockLogs = [{ log_id: 1, action_type: 'Login_Success', result: 'Success' }];
    

    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }) 
      .mockResolvedValueOnce({ rows: mockLogs }); 

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', 'Bearer token');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.logs.length).toBe(1);
    expect(res.body.data.logs[0].actionType).toBe('Login_Success');
  });

  it('should export audit logs as CSV', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    const mockLogs = [
      { log_id: 1, action_type: 'Space_Created', email: 'admin@itu.edu.tr', result: 'Success' }
    ];

    pool.query.mockResolvedValueOnce({ rows: mockLogs }); // Export sorgusu

    const res = await request(app)
      .post('/api/admin/audit-logs/export')
      .set('Authorization', 'Bearer token')
      .send({ format: 'csv', filters: {} });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  
    expect(res.text).toContain('log_id,action_type,email');
    expect(res.text).toContain('Space_Created');
  });



});