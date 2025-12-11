const request = require('supertest');
const app = require('../app');
const pool = require('../config/db'); 


jest.mock('../config/db', () => {
  return {
    query: jest.fn(), 
    connect: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  };
});

describe('Space API Unit Tests (Mock DB)', () => {
  
  // Her testten önce mock'ları temizle 
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. GET (Listeleme)
  it('should return all spaces successfully', async () => {
   
    const mockSpaces = [
      { space_id: 1, space_name: 'Mock Study Room', room_number: 'M-101' },
      { space_id: 2, space_name: 'Mock Lab', room_number: 'L-202' }
    ];

    
    pool.query.mockResolvedValue({ rows: mockSpaces });

    const res = await request(app).get('/api/spaces');

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.spaces.length).toBe(2);
    expect(res.body.data.spaces[0].spaceName).toBe('Mock Study Room'); 
  });

  // 2. POST  (Ekleme)
  it('should create a new space successfully', async () => {
    const newSpace = {
      buildingId: 1,
      spaceName: "Yeni Mock Oda",
      roomNumber: "M-999",
      floor: 1,
      capacity: 10,
      roomType: "Quiet_Study",
      noiseLevel: "Silent",
      amenities: ["Wifi"],
      operatingHoursWeekdayStart: "09:00",
      operatingHoursWeekdayEnd: "17:00"
    };

    // Veritabanı kayıt işleminden sonra yeni eklenen satırı dönmüş GİBİ yapıyoruz
    const mockDbResponse = {
      space_id: 10,
      building_id: 1,
      space_name: "Yeni Mock Oda",
      room_number: "M-999",
      
    };

    pool.query.mockResolvedValue({ rows: [mockDbResponse] });

    const res = await request(app).post('/api/spaces').send(newSpace);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
   
    expect(pool.query).toHaveBeenCalled(); 
  });

  // 3. PUT  (Güncelleme)
  it('should update a space successfully', async () => {
    const spaceId = 10;
    const updateData = { spaceName: "Güncellenmiş Oda" };

    const mockUpdatedRow = {
      space_id: 10,
      space_name: "Güncellenmiş Oda"
    };

    // Veritabanı güncelleme yapıp yeni halini dönmüş GİBİ yapıyoruz
    pool.query.mockResolvedValue({ rows: [mockUpdatedRow] });

    const res = await request(app).put(`/api/spaces/${spaceId}`).send(updateData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.spaceName).toBe("Güncellenmiş Oda");
  });

  // 4. DELETE  (Silme)
  it('should delete a space successfully', async () => {
    const spaceId = 10;

    const mockDeletedRow = {
      space_id: 10,
      status: 'Deleted'
    };

    // Silme işlemi (soft delete) başarılı olmuş GİBİ yapıyoruz
    pool.query.mockResolvedValue({ rows: [mockDeletedRow] });

    const res = await request(app).delete(`/api/spaces/${spaceId}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.data.status).toBe('Deleted');
  });

  // 5. Error Handling
  it('should handle database errors gracefully', async () => {
    
    pool.query.mockRejectedValue(new Error("Database connection failed"));

    const res = await request(app).get('/api/spaces');

    expect(res.statusCode).toEqual(500);
    expect(res.body.success).toBe(false);
  });
});