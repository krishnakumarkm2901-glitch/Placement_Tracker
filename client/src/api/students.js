import api from './axios';

export const studentsAPI = {
  getAll: (params) => api.get('/students', { params }),
  getById: (id) => api.get(`/students/${id}`),
  getPublic: () => api.get('/students/public'),
  getPublicById: (id) => api.get(`/students/public/${id}`),
  getPublicPlatform: (platform, params) => api.get(`/students/public/platform/${platform}`, { params }),
  create: (data) => api.post('/students', data),
  importExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/students/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  downloadImportTemplate: () => api.get('/students/import-template', { responseType: 'blob' }),
  update: (id, data) => api.put(`/students/${id}`, data),
  syncPlatforms: (id) => api.post(`/students/${id}/platforms/sync`),
  delete: (id) => api.delete(`/students/${id}`),
  getDepartments: () => api.get('/students/departments'),
  getYears: () => api.get('/students/years'),
};

export default studentsAPI;
