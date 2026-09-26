import api from './axiosClient';
import { User } from '../types';

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface TwoFactorStatus { enabled: boolean; backupCodesLeft: number }
export interface TwoFactorSetup { secret: string; otpauthUrl: string; qrDataUrl: string }
/** Login either finishes, or stops and asks for the second factor. */
export type SignInResult =
  | { requiresTwoFactor: true; challengeToken: string }
  | { requiresTwoFactor?: undefined; user: User; accessToken: string; refreshToken: string };

export const authApi = {
  /** Fetches the Google authorize URL, then the caller navigates there from this origin. */
  googleUrl: async (): Promise<string> => (await api.get('/auth/google')).data.data.url,
  twoFactorStatus: async (): Promise<TwoFactorStatus> => (await api.get('/auth/2fa')).data.data,
  twoFactorSetup: async (): Promise<TwoFactorSetup> => (await api.post('/auth/2fa/setup')).data.data,
  twoFactorEnable: async (token: string): Promise<{ backupCodes: string[] }> =>
    (await api.post('/auth/2fa/enable', { token })).data.data,
  twoFactorDisable: async (password: string): Promise<void> => {
    await api.post('/auth/2fa/disable', { password });
  },
  twoFactorVerify: async (challengeToken: string, code: string): Promise<SignInResult> =>
    (await api.post('/auth/2fa/verify', { challengeToken, code })).data.data,
  register: async (data: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<AuthResponse> => (await api.post('/auth/register', data)).data.data,

  login: async (data: { email: string; password: string }): Promise<SignInResult> =>
    (await api.post('/auth/login', data)).data.data,

  refresh: async (refreshToken: string) =>
    (await api.post('/auth/refresh', { refreshToken })).data.data,

  logoutAll: async (): Promise<{ revoked: number }> => (await api.post('/auth/logout-all')).data.data,
  logout: async (refreshToken?: string): Promise<void> => {
    await api.post('/auth/logout', { refreshToken });
  },

  getMe: async (): Promise<User> => (await api.get('/auth/me')).data.data,
};
