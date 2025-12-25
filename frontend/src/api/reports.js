import api from './axios';

export const reportsApi = {
  // Student - Create report
  create: (data) => api.post('/reports', data),
  
  // Public - Get report by defense token
  getByToken: (token) => api.get(`/reports/defense/${token}`),
  
  // Public - Submit defense
  submitDefense: (token, defenseMessage) => 
    api.post(`/reports/defense/${token}`, { defenseMessage }),
  
  // Admin - Get all reports
  getAll: (params) => api.get('/reports', { params }),
  
  // Admin - Get single report
  getById: (id) => api.get(`/reports/${id}`),
  
  // Admin - Mark as reviewed
  markAsReviewed: (id, notes) => 
    api.put(`/reports/${id}/reviewed`, { notes }),
  
  // Admin - Get pending count
  getPendingCount: () => api.get('/reports/pending-count'),
};
