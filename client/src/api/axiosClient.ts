import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)));
  failedQueue = [];
}

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const stored = localStorage.getItem('auth-storage');
  if (stored) {
    try {
      const token = JSON.parse(stored)?.state?.accessToken;
      if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isExpired =
      error.response?.status === 401 &&
      (error.response?.data as { code?: string })?.code === 'TOKEN_EXPIRED';
    if (!isExpired || original._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;
    try {
      const stored = localStorage.getItem('auth-storage');
      const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;
      const res = await axios.post(BASE_URL + '/auth/refresh', { refreshToken });
      const { accessToken, refreshToken: rotated } = res.data.data;
      const { useAuthStore } = await import('../stores/authStore');
      // Keep the rotated refresh token: the one we just spent was deleted server-side.
      useAuthStore.getState().setAccessToken(accessToken, rotated);
      processQueue(null, accessToken);
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      processQueue(refreshError, null);
      const { useAuthStore } = await import('../stores/authStore');
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
