import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
let sessionToken = null;

export const setAuthToken = (token) => {
  sessionToken = token || null;
};

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    if (sessionToken) {
      config.headers.Authorization = `Bearer ${sessionToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionToken = null;
      sessionStorage.removeItem('placement_tracker_session_token');
      sessionStorage.removeItem('placement_tracker_session_user');
      if (window.location.pathname !== '/loginadmin') {
        window.location.href = '/loginadmin';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
