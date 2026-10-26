import axios, { AxiosInstance } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken || typeof window !== 'undefined') {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, refreshToken ? { refreshToken } : {}, { withCredentials: true });
          setTokens(res.data.data.accessToken, res.data.data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
          return api(originalRequest);
        } catch {
          clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
