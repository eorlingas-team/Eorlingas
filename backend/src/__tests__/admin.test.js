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

jest.mock('../models/userModel', () => ({ findById: jest.fn() }));
jest.mock('../utils/jwtUtils', () => ({ verifyAccessToken: jest.fn() }));

describe('Administrative API Tests (Comprehensive)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });



  it('should return system stats for Administrator', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '100' }] }) 
      .mockResolvedValueOnce({ rows: [{ total: '10' }] })  
      .mockResolvedValueOnce({ rows: [{ total: '500' }] }); 

    const res = await request(app).get('/api/admin/stats').set('Authorization', 'Bearer token');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.statistics.totalUsers).toBe(100);
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

    const updatedUser = { user_id: 5, status: 'Suspended' };
    pool.query.mockResolvedValueOnce({ rows: [updatedUser] });

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

    
    //  BEGIN
    mockClient.query.mockResolvedValueOnce({}); 
    // SELECT 
    mockClient.query.mockResolvedValueOnce({ rows: [] }); 
    //  INSERT 
    mockClient.query.mockResolvedValueOnce({ rows: [{ space_id: 1, space_name: 'New Room' }] });
    //  COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/admin/spaces')
      .set('Authorization', 'Bearer token')
      .send({
        buildingId: 1,
        spaceName: 'New Room',
        roomNumber: '101'
      });

   
    if (res.statusCode !== 201) {
      console.log('Create Space Error Body:', res.body);
    }

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should update status to Maintenance', async () => {
    verifyAccessToken.mockReturnValue({ userId: 2, role: 'Space_Manager' });
    userModel.findById.mockResolvedValue({ user_id: 2, role: 'Space_Manager', status: 'Verified' });

   
    // 1. BEGIN
    mockClient.query.mockResolvedValueOnce({});
    // 2. UPDATE Space Status
    mockClient.query.mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Maintenance' }] });
    // 3. UPDATE Bookings 
    mockClient.query.mockResolvedValueOnce({ rowCount: 5 }); 
    // 4. COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const res = await request(app)
      .put('/api/admin/spaces/1/status')
      .set('Authorization', 'Bearer token')
      .send({
        status: 'Maintenance',
        maintenanceStartDate: '2025-10-20',
        maintenanceEndDate: '2025-10-25'
      });
    
    if (res.statusCode !== 200) console.log('Update Status Error:', res.body);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.space.status).toBe('Maintenance');
    expect(res.body.data.cancelledBookingsCount).toBe(5);
  });

  it('should soft delete space', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    
    // BEGIN
    mockClient.query.mockResolvedValueOnce({});
    //  UPDATE Space 
    mockClient.query.mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Deleted' }] }); 
    //  UPDATE Bookings 
    mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); 
    // COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const res = await request(app).delete('/api/admin/spaces/1').set('Authorization', 'Bearer token').send({});
    
    if (res.statusCode !== 200) console.log('Delete Space Error:', res.body);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.space.status).toBe('Deleted');
  });



  it('should list audit logs (Admin)', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    
    const mockLogs = [{ log_id: 1, action_type: 'Login_Success', result: 'Success' }];
    

    pool.query
      .mockResolvedValueOnce({ rows: mockLogs }) 
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); 

    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', 'Bearer token');

    expect(res.statusCode).toBe(200);
    expect(res.body.data.logs.length).toBe(1);
    expect(res.body.data.logs[0].action_type).toBe('Login_Success');
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