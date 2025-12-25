const request = require('supertest');
const app = require('../app');
const reportService = require('../services/reportService');
const reportModel = require('../models/reportModel');
const { verifyAccessToken } = require('../utils/jwtUtils');
const userModel = require('../models/userModel');

// Mock dependencies
jest.mock('../services/reportService');
jest.mock('../models/reportModel');
jest.mock('../utils/jwtUtils');
jest.mock('../models/userModel');
jest.mock('../utils/auditLogger');

describe('Report API Unit Tests', () => {
  const mockUserId = 1;
  const mockAdminId = 999;
  const mockUserRole = 'Student';
  const mockAdminRole = 'Administrator';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default user mock for auth middleware
    userModel.findById.mockImplementation((id) => {
        if (id === mockUserId) return Promise.resolve({ user_id: mockUserId, role: mockUserRole, status: 'Active' });
        if (id === mockAdminId) return Promise.resolve({ user_id: mockAdminId, role: mockAdminRole, status: 'Active' });
        return Promise.resolve(null);
    });
  });

  describe('POST /api/reports', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue({
        userId: mockUserId,
        role: mockUserRole
      });
    });

    it('should create a report successfully', async () => {
      const reportData = {
        spaceId: 101,
        reportTime: '2025-12-25T14:30:00Z',
        message: 'The space is too noisy and dirty.'
      };

      const mockCreatedReport = {
        reportId: 50,
        ...reportData,
        reporterId: mockUserId,
        status: 'Pending'
      };

      reportService.createReport.mockResolvedValue(mockCreatedReport);

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer user-token')
        .send(reportData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reportId).toBe(50);
      expect(reportService.createReport).toHaveBeenCalledWith(mockUserId, expect.objectContaining({
        spaceId: 101,
        message: 'The space is too noisy and dirty.'
      }));
    });

    it('should validate input length', async () => {
      const reportData = {
        spaceId: 101,
        reportTime: '2025-12-25T14:30:00Z',
        message: 'Too short'
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer user-token')
        .send(reportData);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      const reportData = {
        spaceId: 101,
        reportTime: '2025-12-25T14:30:00Z',
        message: 'Valid message length here'
      };

      const error = new Error('Service Error');
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      
      reportService.createReport.mockRejectedValue(error);

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', 'Bearer user-token')
        .send(reportData);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('GET /api/reports (Admin)', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue({
        userId: mockAdminId,
        role: mockAdminRole
      });
    });

    it('should return reports and pending count', async () => {
      const mockReports = [{ id: 1, message: 'Test' }];
      reportService.getAllReports.mockResolvedValue(mockReports);
      reportModel.countPending.mockResolvedValue(5);

      const res = await request(app)
        .get('/api/reports')
        .set('Authorization', 'Bearer admin-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.data.reports).toEqual(mockReports);
      expect(res.body.data.pendingCount).toBe(5);
    });

    it('should filter by status', async () => {
      reportService.getAllReports.mockResolvedValue([]);
      reportModel.countPending.mockResolvedValue(0);

      await request(app)
        .get('/api/reports?status=Pending')
        .set('Authorization', 'Bearer admin-token');

      expect(reportService.getAllReports).toHaveBeenCalledWith({ status: 'Pending' });
    });
  });

  describe('PUT /api/reports/:id/reviewed', () => {
    beforeEach(() => {
      verifyAccessToken.mockReturnValue({
        userId: mockAdminId,
        role: mockAdminRole
      });
    });

    it('should mark report as reviewed', async () => {
      const reportId = 1;
      const notes = 'Investigated and resolved';
      const mockUpdatedReport = { id: reportId, status: 'Reviewed', adminNotes: notes };

      reportService.markAsReviewed.mockResolvedValue(mockUpdatedReport);

      const res = await request(app)
        .put(`/api/reports/${reportId}/reviewed`)
        .set('Authorization', 'Bearer admin-token')
        .send({ notes });

      expect(res.statusCode).toBe(200);
      expect(reportService.markAsReviewed).toHaveBeenCalledWith(reportId, mockAdminId, notes);
    });
  });

  describe('Defense APIs', () => {
    it('public: should get report by token', async () => {
      const token = 'valid-token-123';
      const mockReport = {
        reportId: 10,
        booking: {},
        space: {},
        defenseMessage: null
      };

      reportModel.findByDefenseToken.mockResolvedValue(mockReport);

      const res = await request(app).get(`/api/reports/defense/${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.report.reportId).toBe(10);
    });

    it('public: should return 404 for invalid token', async () => {
      reportModel.findByDefenseToken.mockResolvedValue(null);

      const res = await request(app).get('/api/reports/defense/invalid');

      expect(res.statusCode).toBe(404);
    });

    it('public: should submit defense', async () => {
      const token = 'valid-token';
      const defenseMessage = 'This is my defense statement with enough length.';
      const mockResult = { reportId: 10 };

      reportService.submitDefense.mockResolvedValue(mockResult);

      const res = await request(app)
        .post(`/api/reports/defense/${token}`)
        .send({ defenseMessage });

      expect(res.statusCode).toBe(200);
      expect(reportService.submitDefense).toHaveBeenCalledWith(token, defenseMessage);
    });
  });
});
