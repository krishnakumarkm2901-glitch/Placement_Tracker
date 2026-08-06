import api from './axios';

export const analyticsAPI = {
  getDashboard: () => api.get('/analytics/dashboard'),
};

export default analyticsAPI;
