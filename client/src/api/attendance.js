import api from './axios';

const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getStudent: (studentId, params) => api.get(`/attendance/student/${studentId}`, { params }),
  refresh: () => api.post('/attendance/refresh'),
};

export default attendanceAPI;
