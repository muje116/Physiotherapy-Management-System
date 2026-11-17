import axios, { AxiosInstance } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function getApiErrorMessage(error: unknown, fallback = 'The request could not be completed. Please try again.') {
  const candidate = error as {
    message?: unknown;
    response?: { data?: { message?: unknown; error?: unknown } };
  } | null;
  const responseData = candidate?.response?.data;
  const responseError = responseData?.error;

  if (typeof responseError === 'string' && responseError.trim()) return responseError;
  if (responseError && typeof responseError === 'object') {
    const message = (responseError as { message?: unknown }).message;
    const requestId = (responseError as { requestId?: unknown }).requestId;
    if (typeof message === 'string' && message.trim()) {
      return typeof requestId === 'string' && requestId.trim()
        ? `${message} (Reference: ${requestId})`
        : message;
    }
  }
  if (typeof responseData?.message === 'string' && responseData.message.trim()) return responseData.message;
  if (typeof candidate?.message === 'string' && candidate.message.trim()) return candidate.message;
  return fallback;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
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
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken || typeof window !== 'undefined') {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, refreshToken ? { refreshToken } : {}, {
            withCredentials: true,
            timeout: api.defaults.timeout,
          });
          setTokens(res.data.data.accessToken, res.data.data.refreshToken);
          return api(originalRequest);
        } catch {
          clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        }
      }
    }

    if (axios.isAxiosError(error)) {
      const responseError = error.response?.data?.error;
      const baseMessage = typeof responseError?.message === 'string'
        ? responseError.message
        : typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
            ? 'The request took too long. Please try again.'
            : !error.response
              ? 'Unable to reach the server. Check your connection and try again.'
              : 'The request could not be completed. Please try again.';
      const requestId = typeof responseError?.requestId === 'string' ? responseError.requestId : null;
      error.message = requestId ? `${baseMessage} (Reference: ${requestId})` : baseMessage;
    }

    return Promise.reject(error);
  }
);

export default api;
