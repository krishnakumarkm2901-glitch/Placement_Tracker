import api from './axios';

export const reportsAPI = {
  getStudentReport: (params) => api.get('/reports/students', { params }),
  getLeaderboardReport: (params) => api.get('/reports/leaderboard', { params }),
  getDepartmentReport: (params) => api.get('/reports/departments', { params }),
  exportExcel: (type, params) => api.get(`/reports/${type}`, { params: { ...params, format: 'xlsx' }, responseType: 'blob' }),
  getPlatformReport: (platform, params) => api.get(`/reports/platform/${platform}`, { params }),
  exportPlatformReport: (platform, params) => api.get(`/reports/platform/${platform}`, { params: { ...params, format: 'xlsx' }, responseType: 'blob' }),
};

export default reportsAPI;
