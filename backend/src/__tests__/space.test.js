const request = require('supertest');
const app = require('../app');
const pool = require('../config/db');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

describe('Space API Integration Tests (Ayazaga Campus)', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should list all spaces with pagination and correct structure', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '15' }] });
    const mockSpaces = [{
        space_id: 1,
        space_name: 'Library Quiet Zone',
        building_name: 'Merkez Kütüphane',
        status: 'Available',
    }];
    pool.query.mockResolvedValueOnce({ rows: mockSpaces });

    const res = await request(app).get('/api/spaces?page=1&limit=10');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.spaces[0].building.campus.campusName).toBe('Ayazağa Kampüsü');
  });

  it('should filter spaces by search term and parameters', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    pool.query.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/spaces?search=Silent&noiseLevel=Quiet');
    const executedQuery = pool.query.mock.calls[1][0]; 
    expect(executedQuery).toContain('AND s.noise_level = $');
  });

  it('should return empty list if no spaces match filters', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/spaces?search=YokBoyleBirOda');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.spaces).toEqual([]);
  });

  it('should handle database errors gracefully (500)', async () => {
    pool.query.mockRejectedValue(new Error('Database Connection Failed'));
    const res = await request(app).get('/api/spaces');
    expect(res.statusCode).toBe(500);
  });

  it('should return space details by ID', async () => {
    const mockSpace = {
      space_id: 10,
      space_name: 'Lab 3',
      building_name: 'Bilgisayar Bilişim',
      status: 'Available',
    };
    pool.query.mockResolvedValueOnce({ rows: [mockSpace] });
    const res = await request(app).get('/api/spaces/10');
    expect(res.statusCode).toBe(200);
  });

  it('should return 404 if space ID does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/spaces/9999');
    expect(res.statusCode).toBe(404);
  });

  it('should handle database errors in detail view (500)', async () => {
    pool.query.mockRejectedValue(new Error('Critical DB Error'));
    const res = await request(app).get('/api/spaces/1');
    expect(res.statusCode).toBe(500);
  });
});