import api from './axios';

const dailyTaskReportsAPI = {
  getReport: (params) => api.get('/daily-task-reports', { params }),
  getAvailableDates: (platform) => api.get('/daily-task-reports/dates', { params: { platform } }),
  exportReport: (params) => api.get('/daily-task-reports/export', { params, responseType: 'blob' }),
};

export default dailyTaskReportsAPI;
