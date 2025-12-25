jest.mock('../config/db', () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return {
    query: jest.fn(),
    connect: jest.fn(() => mClient),
    on: jest.fn(),
    end: jest.fn(),
    __mockClient: mClient,
  };
});

const pool = require('../config/db');
const mockClient = pool.__mockClient;

jest.mock('../models/userModel');
jest.mock('../models/bookingModel');
jest.mock('../utils/auditLogger', () => jest.fn().mockResolvedValue({ success: true }));

jest.mock('../services/recommendationService', () => ({
  scoreAndSortSpaces: jest.fn(),
  getPopularSpaces: jest.fn()
}));

jest.mock('../utils/jwtUtils', () => ({
  verifyAccessToken: jest.fn(),
}));

const request = require('supertest');
const app = require('../app');
const recommendationService = require('../services/recommendationService');
const userModel = require('../models/userModel');
const bookingModel = require('../models/bookingModel');
const { verifyAccessToken } = require('../utils/jwtUtils');


describe('Space API Unit Tests (Mock DB)', () => {
  
  beforeEach(() => {
    // Use mockReset() to fully reset mocks including mockImplementation
    pool.query.mockReset();
    mockClient.query.mockReset();
    mockClient.release.mockReset();
    
    // Reset other mocks
    if (userModel.findById.mockReset) userModel.findById.mockReset();
    if (bookingModel.findUpcomingBySpaceIdWithUser.mockReset) bookingModel.findUpcomingBySpaceIdWithUser.mockReset();
    
    bookingModel.findUpcomingBySpaceIdWithUser.mockResolvedValue([]);
  });

  // 1. GET (Listeleme & Smart Sort)
  it('should return all spaces sorted by recommendation service', async () => {
   
    // Mock DB response (Filtering/Listing result)
    const mockSpacesRaw = [
      { space_id: 1, space_name: 'Raw Space 1', status: 'Available' },
      { space_id: 2, space_name: 'Raw Space 2', status: 'Available' }
    ];

    // Mock count query response
    const mockCountRaw = { count: '2' };

    // Setup pool mock to return raw spaces then count
    pool.query
      .mockResolvedValueOnce({ rows: mockSpacesRaw }) // Main query
      .mockResolvedValueOnce({ rows: [mockCountRaw] }); // Count query

    // Mock Recommendation Service to return sorted/modified list
    const mockSortedSpaces = [
        { space_id: 2, space_name: 'Raw Space 2', matchScore: 50 },
        { space_id: 1, space_name: 'Raw Space 1', matchScore: 10 }
    ];
    recommendationService.scoreAndSortSpaces.mockResolvedValue(mockSortedSpaces);

    const res = await request(app).get('/api/spaces?userId=1');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.spaces[0].spaceName).toBe('Raw Space 2'); // Sorted order
    expect(recommendationService.scoreAndSortSpaces).toHaveBeenCalledWith(mockSpacesRaw, "1");
  });

  // 2. SEARCH
  it('should search spaces and sort them', async () => {
    const mockSpacesRaw = [{ space_id: 3, space_name: 'Library', status: 'Available' }];
    const mockCountRaw = { count: '1' };

    pool.query
       .mockResolvedValueOnce({ rows: mockSpacesRaw }) // Search query
       .mockResolvedValueOnce({ rows: [mockCountRaw] }); // Count query

    recommendationService.scoreAndSortSpaces.mockResolvedValue(mockSpacesRaw);

    const res = await request(app).get('/api/spaces/search?q=Library');

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.spaces[0].spaceName).toBe('Library');
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.anything());
  });

  // 3. GET AVAILABILITY
  it('should return availability for a space', async () => {
    const spaceId = 1;
    const startDate = '2025-12-20';
    const endDate = '2025-12-21';

    // Mock space exists check
    pool.query.mockResolvedValueOnce({ rows: [{ space_id: 1 }] }); 
    // Mock bookings query
    const mockBookings = [
        { start_time: '2025-12-20T10:00:00Z', end_time: '2025-12-20T12:00:00Z' }
    ];
    pool.query.mockResolvedValueOnce({ rows: mockBookings });

    const res = await request(app).get(`/api/spaces/${spaceId}/availability?startDate=${startDate}&endDate=${endDate}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.availability).toBeDefined();
    expect(res.body.data.dateRange.start).toBe(startDate);
  });

  // 4. POST (Ekleme - Admin)
  it('should create a new space successfully', async () => {
    const newSpace = {
      buildingId: 1,
      spaceName: "Test Room",
      roomNumber: "T-100",
      floor: 1,
      capacity: 10,
      roomType: "Quiet_Study",
      noiseLevel: "Silent",
      amenities: ["Wifi"],
      operatingHours: {
        weekday: { start: "08:00", end: "22:00" },
        weekend: { start: "10:00", end: "20:00" }
      }
    };

    const mockDbResponse = {
      space_id: 100,
      building_id: 1,
      space_name: "Test Room",
      room_number: "T-100",
      floor: 1,
      capacity: 10,
      room_type: "Quiet_Study",
      noise_level: "Silent",
      status: 'Available',
      operating_hours_weekday_start: '08:00',
      operating_hours_weekday_end: '22:00',
      operating_hours_weekend_start: '10:00',
      operating_hours_weekend_end: '20:00',
      amenities: JSON.stringify(["Wifi"]),
      accessibility_features: JSON.stringify([])
    };

    // Mock Auth
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });
    bookingModel.findUpcomingBySpaceIdWithUser.mockResolvedValue([]);

    // Mock pool.query calls in order: unique check, insert, audit log
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // Unique check - no duplicate
      .mockResolvedValueOnce({ rows: [mockDbResponse] }) // Insert query
      .mockResolvedValueOnce({ rows: [{ log_id: 1 }] }); // Audit log

    const res = await request(app)
      .post('/api/spaces')
      .set('Authorization', 'Bearer token')
      .send(newSpace);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.spaceName).toBe('Test Room');
  });

  // 5. DELETE (Silme - Admin)
  it('should delete a space successfully', async () => {
    const spaceId = 10;
    const mockDeletedRow = { space_id: 10, status: 'Deleted' };

    // Mock Auth
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });
    bookingModel.findUpcomingBySpaceIdWithUser.mockResolvedValue([]);

    // deleteSpace uses client.query
    mockClient.query
       .mockResolvedValueOnce({ rows: [] }) // BEGIN
       .mockResolvedValueOnce({ rows: [mockDeletedRow] }) // UPDATE
       .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(app)
      .delete(`/api/spaces/${spaceId}`)
      .set('Authorization', 'Bearer token');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    // Ensure the data object contains the status
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('Deleted');
  });

  // 6. Validation Error Handling
  it('should return 400 if search query is missing', async () => {
      const res = await request(app).get('/api/spaces/search');
      expect(res.statusCode).toEqual(400);
  });

  it('should return 400 if availability dates are missing', async () => {
    const res = await request(app).get('/api/spaces/1/availability');
    expect(res.statusCode).toEqual(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // 7. Not Found Error Handling
  it('should return 404 when getting a non-existent space', async () => {
    // getSpaceById uses Promise.all with 2 parallel queries
    // When space is not found, both queries complete but first returns empty
    pool.query.mockImplementation((query) => {
      // Both queries run in parallel via Promise.all
      if (query.includes('FROM study_spaces s')) {
        return Promise.resolve({ rows: [] }); // Space query - no space found
      }
      if (query.includes('FROM bookings')) {
        return Promise.resolve({ rows: [] }); // Bookings query
      }
      return Promise.resolve({ rows: [] });
    });
    
    const res = await request(app).get('/api/spaces/999');
    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('should return 404 when updating a non-existent space', async () => {
    // Mock Auth
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // SELECT returns empty
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(app)
      .put('/api/spaces/999')
      .set('Authorization', 'Bearer token')
      .send({ spaceName: "New" });
    expect(res.statusCode).toEqual(404);
  });

  it('should return 404 when deleting a non-existent space', async () => {
    // Mock Auth
    verifyAccessToken.mockReturnValue({ userId: 1, role: 'Administrator' });
    userModel.findById.mockResolvedValue({ user_id: 1, role: 'Administrator', status: 'Verified' });
    bookingModel.findUpcomingBySpaceIdWithUser.mockResolvedValue([]);

    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // DELETE returns empty
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const res = await request(app)
      .delete('/api/spaces/999')
      .set('Authorization', 'Bearer token');
    expect(res.statusCode).toEqual(404);
  });

  it('should return 404 when checking availability for non-existent space', async () => {
    // getSpaceAvailability uses a single query with JOIN
    // Mock to return empty rows for non-existent space
    pool.query.mockImplementation((query) => {
      if (query.includes('FROM study_spaces s') && query.includes('JOIN buildings b')) {
        return Promise.resolve({ rows: [] }); // Space check with JOIN returns empty
      }
      return Promise.resolve({ rows: [] });
    });
    
    const res = await request(app).get('/api/spaces/999/availability?startDate=2025-01-01&endDate=2025-01-02');
    expect(res.statusCode).toEqual(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
  
  // 8. Server Error Handling
  it('should return 500 on db error', async () => {
    // Mock a database error
    pool.query.mockRejectedValueOnce(new Error("Database connection failed"));
    
    const res = await request(app).get('/api/spaces');
    expect(res.statusCode).toEqual(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVER_ERROR');
  });
});