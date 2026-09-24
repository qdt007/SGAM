import api from './axiosClient';
import { User } from '../types';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  email: string;
}
export interface MyStats {
  projects: number;
  assigned: number;
  done: number;
  overdue: number;
}
export interface NotificationPrefs {
  taskAssigned: boolean;
  taskUpdated: boolean;
  taskCommented: boolean;
  mentioned: boolean;
  deadlineApproaching: boolean;
  projectInvite: boolean;
  fileUploaded: boolean;
  emailEnabled: boolean;
}

export const usersApi = {
  search: async (q: string, projectId?: string, limit = 10): Promise<UserSummary[]> =>
    (await api.get('/users/search', { params: { q, projectId, limit } })).data.data,
  get: async (id: string): Promise<User> => (await api.get('/users/' + id)).data.data,
  myStats: async (): Promise<MyStats> => (await api.get('/users/me/stats')).data.data,
  updateMe: async (data: { displayName?: string; username?: string; avatarUrl?: string | null }): Promise<User> =>
    (await api.patch('/users/me', data)).data.data,
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    await api.patch('/users/me/password', data);
  },
  getNotificationPrefs: async (): Promise<NotificationPrefs> =>
    (await api.get('/users/me/notification-prefs')).data.data,
  updateNotificationPrefs: async (data: Partial<NotificationPrefs>): Promise<NotificationPrefs> =>
    (await api.patch('/users/me/notification-prefs', data)).data.data,
};
