import api from './axiosClient';
import { GlobalRole, PaginationMeta } from '../types';

export interface AdminStats {
  users: { total: number; active: number; admins: number; newThisWeek: number };
  projects: { total: number };
  tasks: { total: number; done: number; overdue: number; byStatus: { status: string; count: number }[] };
  billing: { proSubscriptions: number; paidPayments: number; revenue: number };
  signupSeries: { date: string; count: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  isActive: boolean;
  createdAt: string;
  _count: { projectMemberships: number; assignedTasks: number };
  subscription: { tier: 'FREE' | 'PRO'; status: string; currentPeriodEnd: string | null } | null;
}

export const adminApi = {
  stats: async (): Promise<AdminStats> => (await api.get('/admin/stats')).data.data,
  users: async (q: string, page = 1, limit = 20): Promise<{ data: AdminUser[]; meta: PaginationMeta }> => {
    const res = await api.get('/admin/users', { params: { q: q || undefined, page, limit } });
    return { data: res.data.data, meta: res.data.meta };
  },
  updateUser: async (id: string, data: { globalRole?: GlobalRole; isActive?: boolean }): Promise<AdminUser> =>
    (await api.patch('/admin/users/' + id, data)).data.data,
};
