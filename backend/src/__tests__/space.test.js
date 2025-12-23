const request = require('supertest');
const app = require('../app');
const pool = require('../config/db'); 
const recommendationService = require('../services/recommendationService');

// Mock DB
jest.mock('../config/db', () => ({
  query: jest.fn(), 
  connect: jest.fn(),
  on: jest.fn(),
  end: jest.fn(),
}));

// Mock Recommendation Service
jest.mock('../services/recommendationService', () => ({
  scoreAndSortSpaces: jest.fn(),
  getPopularSpaces: jest.fn()
}));

describe('Space API Unit Tests (Mock DB)', () => {
  
  beforeEach(() => {
    jest.resetAllMocks();
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
      spaceName: "Yeni Mock Oda",
      roomNumber: "M-999",
      floor: 1,
      capacity: 10,
      roomType: "Quiet_Study",
      noiseLevel: "Silent",
      amenities: ["Wifi"]
    };

    const mockDbResponse = {
      space_id: 10,
      building_id: 1,
      space_name: "Yeni Mock Oda",
      room_number: "M-999",
      status: 'Available'
    };

    // Mock unique check query response (no existing room)
    pool.query.mockResolvedValueOnce({ rows: [] });
    // Mock create query response
    pool.query.mockResolvedValueOnce({ rows: [mockDbResponse] });
    // Audit log
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).post('/api/spaces').send(newSpace);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
  });

  // 5. DELETE (Silme - Admin)
  it('should delete a space successfully', async () => {
    const spaceId = 10;
    const mockDeletedRow = { space_id: 10, status: 'Deleted' };

    // deleteSpace uses pool.query once
    pool.query.mockResolvedValueOnce({ rows: [mockDeletedRow] });

    const res = await request(app).delete(`/api/spaces/${spaceId}`);

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
    pool.query.mockResolvedValueOnce({ rows: [] }); // Empty result
    const res = await request(app).get('/api/spaces/999');
    expect(res.statusCode).toEqual(404);
  });

  it('should return 404 when updating a non-existent space', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // Update returns empty
    const res = await request(app).put('/api/spaces/999').send({ spaceName: "New" });
    expect(res.statusCode).toEqual(404);
  });

  it('should return 404 when deleting a non-existent space', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // Update returns empty
    const res = await request(app).delete('/api/spaces/999');
    expect(res.statusCode).toEqual(404);
  });

  it('should return 404 when checking availability for non-existent space', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // Space check returns empty
    const res = await request(app).get('/api/spaces/999/availability?startDate=2025-01-01&endDate=2025-01-02');
    expect(res.statusCode).toEqual(404);
  });
  
  // 8. Server Error Handling
  it('should return 500 on db error', async () => {
    pool.query.mockRejectedValue(new Error("DB Error"));
    const res = await request(app).get('/api/spaces');
    expect(res.statusCode).toEqual(500);
  });
});