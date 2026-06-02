import api from './axiosClient';
import { Notification } from '../types';

export const notificationsApi = {
  list: async (page = 1, limit = 20) =>
    (await api.get('/notifications', { params: { page, limit } })).data as {
      data: Notification[];
      meta: unknown;
    },
  markRead: async (id: string): Promise<void> => {
    await api.patch('/notifications/' + id + '/read');
  },
  markAllRead: async (): Promise<void> => {
    await api.patch('/notifications/read-all');
  },
  delete: async (id: string): Promise<void> => {
    await api.delete('/notifications/' + id);
  },
};
