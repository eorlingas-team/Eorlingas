import api from './axios';

export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  getUserBookings: (params) => api.get('/bookings', { params }),
  getById: (id) => api.get(`/bookings/${id}`),
  cancel: (id, reason) => api.delete(`/bookings/${id}`, { data: { reason } }),
};
