import api from './axios';

export const spacesApi = {
  getAll: (params) => {
    console.log("spacesApi.getAll called with:", params);
    return api.get('/spaces', { params });
  },
  search: (params) => {
    console.log("spacesApi.search called with:", params);
    return api.get('/spaces/search', { params });
  },
  getById: (id) => api.get(`/spaces/${id}`),
  getAvailability: (id, params) => api.get(`/spaces/${id}/availability`, { params }),
  
  getFilterOptions: () => {
    console.log("spacesApi.getFilterOptions called");
    return api.get('/spaces/filters');
  },
  
  getStats: () => api.get('/spaces/stats'),
  
  getAllAdmin: (params) => api.get('/spaces', { params }),
  create: (data) => api.post('/spaces', data),
  update: (id, data) => api.put(`/spaces/${id}`, data),
  remove: (id) => api.delete(`/spaces/${id}`),
  updateStatus: (id, status) => api.put(`/spaces/${id}`, { status }),
};
