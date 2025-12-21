const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');
const userModel = require('../models/userModel');
const { verifyAccessToken } = require('../utils/jwtUtils');

// --- MOCK KURULUMU ---

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

// DB Pool Mock
jest.mock('../config/db', () => ({
  query: jest.fn(),                // Eski controllerlar için (Stats, Users)
  connect: jest.fn(() => mockClient), // Yeni controllerlar için (Space - Transaction)
}));

jest.mock('../models/userModel', () => ({ findById: jest.fn() }));
jest.mock('../utils/jwtUtils', () => ({ verifyAccessToken: jest.fn() }));

describe('Administrative API Tests (Comprehensive)', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================
  // BÖLÜM 1: ESKİ TESTLER (STATS & USERS)
  // ======================================================

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

  // ======================================================
  // BÖLÜM 2: YENİ TESTLER (SPACE MANAGEMENT) - DÜZELTİLDİ ✅
  // ======================================================

  it('should create a space (Admin)', async () => {
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    // SIRAYLA MOCKLAMA (Transaction Sırasına Göre):
    // 1. BEGIN
    mockClient.query.mockResolvedValueOnce({}); 
    // 2. SELECT (Oda no kontrolü - Boş dönerse çakışma yok demektir)
    mockClient.query.mockResolvedValueOnce({ rows: [] }); 
    // 3. INSERT (Mekanı oluştur)
    mockClient.query.mockResolvedValueOnce({ rows: [{ space_id: 1, space_name: 'New Room' }] });
    // 4. COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const res = await request(app)
      .post('/api/admin/spaces')
      .set('Authorization', 'Bearer token')
      .send({
        buildingId: 1,
        spaceName: 'New Room',
        roomNumber: '101'
      });

    // Hata ayıklama için (Eğer yine fail olursa log basar)
    if (res.statusCode !== 201) {
      console.log('Create Space Error Body:', res.body);
    }

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should update status to Maintenance', async () => {
    verifyAccessToken.mockReturnValue({ userId: 2, role: 'Space_Manager' });
    userModel.findById.mockResolvedValue({ user_id: 2, role: 'Space_Manager', status: 'Verified' });

    // Transaction Sırası:
    // 1. BEGIN
    mockClient.query.mockResolvedValueOnce({});
    // 2. UPDATE Space Status
    mockClient.query.mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Maintenance' }] });
    // 3. UPDATE Bookings (Cancel) - Bakıma alınca rezervasyon iptali
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

    // Transaction Sırası:
    // 1. BEGIN
    mockClient.query.mockResolvedValueOnce({});
    // 2. UPDATE Space (Status=Deleted)
    mockClient.query.mockResolvedValueOnce({ rows: [{ space_id: 1, status: 'Deleted' }] }); 
    // 3. UPDATE Bookings (Cancel)
    mockClient.query.mockResolvedValueOnce({ rowCount: 0 }); 
    // 4. COMMIT
    mockClient.query.mockResolvedValueOnce({});

    const res = await request(app).delete('/api/admin/spaces/1').set('Authorization', 'Bearer token').send({});
    
    if (res.statusCode !== 200) console.log('Delete Space Error:', res.body);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.space.status).toBe('Deleted');
  });

});