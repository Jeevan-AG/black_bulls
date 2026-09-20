import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api',
});

// Auto-inject token into headers
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('vantixAdminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 403 && error.response.data.error?.includes("remotely terminated")) {
      alert("CRITICAL ERROR: This project instance has been remotely terminated by the administrator due to unauthorized distribution.");
      sessionStorage.clear();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const registerAdmin = (data) => api.post('/auth/admin-register', data);
export const loginAdmin = (data) => api.post('/auth/admin-login', data);

export default api;
