import api from './axios';

export const adminApi = {
  // System statistics
  getSystemStats: (params) => api.get('/admin/stats', { params }),
  
  // User management
  createUser: (data) => api.post('/admin/users', data),
  getAllUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, action, params) => api.put(`/admin/users/${id}`, { action, params }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  
  // Audit logs
  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),
  exportAuditLogs: (data) => api.post('/admin/audit-logs/export', data, { responseType: 'blob' }), 
};

