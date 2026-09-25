import api from './axiosClient';
import { User } from '../types';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  register: async (data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthResponse> => (await api.post('/auth/register', data)).data.data,

  login: async (data: { email: string; password: string }): Promise<AuthResponse> =>
    (await api.post('/auth/login', data)).data.data,

  refresh: async (refreshToken: string) =>
    (await api.post('/auth/refresh', { refreshToken })).data.data,

  logoutAll: async (): Promise<{ revoked: number }> => (await api.post('/auth/logout-all')).data.data,
  logout: async (refreshToken?: string): Promise<void> => {
    await api.post('/auth/logout', { refreshToken });
  },

  getMe: async (): Promise<User> => (await api.get('/auth/me')).data.data,
};
