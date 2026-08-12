import api from './axios';

const dailyTasksAPI = {
  getToday: (platform = 'leetcode') => api.get(`/daily-tasks/today`, { params: { platform } }),
  setDailyTasks: (data) => api.post(`/daily-tasks`, data),
  getHistory: (platform = 'leetcode', limit = 10, skip = 0) => api.get(`/daily-tasks`, { params: { platform, limit, skip } }),
  getLeetCodeDaily: () => api.get(`/daily-tasks/leetcode-daily`),
};

export default dailyTasksAPI;
