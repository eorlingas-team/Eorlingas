const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');
const userModel = require('../models/userModel'); 
const { verifyAccessToken } = require('../utils/jwtUtils'); 

//  Veritabanı
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

//  User Model
jest.mock('../models/userModel', () => ({
  findById: jest.fn(),
}));

// JWT Utils 
jest.mock('../utils/jwtUtils', () => ({
  verifyAccessToken: jest.fn(),
}));

describe('Administrative API Unit Tests (Mock DB)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  //  İstatistikleri Getir 
  it('should return system stats for Administrator', async () => {

    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    
    
    userModel.findById.mockResolvedValue({ 
      user_id: 1, 
      email: 'admin@itu.edu.tr', 
      role: 'Administrator', 
      status: 'Verified' 
    });

   
    
    pool.query
      .mockResolvedValueOnce({ rows: [{ total: '100' }] }) // Users Count
      .mockResolvedValueOnce({ rows: [{ total: '10' }] })  // Spaces Count
      .mockResolvedValueOnce({ rows: [{ total: '500' }] }); // Bookings Count

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', 'Bearer fake_admin_token'); 

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statistics.totalUsers).toBe(100);
  });

  //  Yetkisiz Giriş (Öğrenci) 
  it('should deny access to non-admin users (Student)', async () => {
    
    verifyAccessToken.mockReturnValue({ userId: 2, role: 'Student' });
    
    userModel.findById.mockResolvedValue({ 
      user_id: 2, 
      role: 'Student', 
      status: 'Verified' 
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', 'Bearer fake_student_token');

    expect(res.statusCode).toEqual(403); // Forbidden
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // Kullanıcı Listeleme 
  it('should list users with pagination', async () => {
   
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    
    const mockUserList = [
      { user_id: 2, full_name: 'Test Student', role: 'Student' },
      { user_id: 3, full_name: 'Test Student 2', role: 'Student' }
    ];

    pool.query
      .mockResolvedValueOnce({ rows: mockUserList })    // getAllUsers 
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // Count 

    const res = await request(app)
      .get('/api/admin/users?page=1&limit=10')
      .set('Authorization', 'Bearer fake_token');

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.users.length).toBe(2);
  });

  //  Kullanıcı Banlama 
  it('should suspend a user successfully', async () => {
   
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

   
    const updatedUser = { user_id: 5, status: 'Suspended' };

    pool.query.mockResolvedValueOnce({ rows: [updatedUser] }); 
    const res = await request(app)
      .put('/api/admin/users/5')
      .set('Authorization', 'Bearer fake_token')
      .send({ action: 'suspend', params: { reason: 'Test' } });

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.user.status).toBe('Suspended');
  });
});