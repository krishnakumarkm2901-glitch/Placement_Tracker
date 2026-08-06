import api from './axios';

export const githubAPI = {
  syncAll: () => api.post('/github/sync'),
  syncStudent: (id) => api.post(`/github/sync/${id}`),
  syncPlatform: (platform) => api.post(`/github/sync/platform/${platform}`),
  getStatus: () => api.get('/github/sync/status'),
};

export default githubAPI;
