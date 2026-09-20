import axios from 'axios';

const CLOUD_API_URL = "https://vantix-backend-7gcw.onrender.com";
const LOCAL_API_URL = "http://localhost:5000";

const getBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return LOCAL_API_URL;
  }
  return CLOUD_API_URL;
};

const api = axios.create({
  baseURL: `${getBaseUrl()}/api`,
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
