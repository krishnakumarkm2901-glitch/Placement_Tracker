import axios from 'axios';

const RENDER_BACKEND_URL = 'https://placement-tracker-tv3g.onrender.com';
const API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app') ? RENDER_BACKEND_URL : '');
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

// Keep-alive ping to prevent Render free tier cold starts (every 10 min)
if (typeof window !== 'undefined' && API_URL) {
  const KEEP_ALIVE_INTERVAL = 10 * 60 * 1000; // 10 minutes
  const pingHealth = () => {
    fetch(`${API_URL}/api/health`, { method: 'GET', mode: 'cors' }).catch(() => {});
  };
  // Initial ping on app load
  pingHealth();
  setInterval(pingHealth, KEEP_ALIVE_INTERVAL);
}

export default api;

