import api from './axiosClient';
import { Project, ProjectMember, KanbanColumn, Tag, ProjectRole } from '../types';

export const projectsApi = {
  list: async (): Promise<Project[]> => (await api.get('/projects')).data.data,
  create: async (data: Partial<Project>): Promise<Project> => (await api.post('/projects', data)).data.data,
  get: async (id: string): Promise<Project> => (await api.get('/projects/' + id)).data.data,
  update: async (id: string, data: Partial<Project>): Promise<Project> =>
    (await api.patch('/projects/' + id, data)).data.data,
  delete: async (id: string): Promise<void> => { await api.delete('/projects/' + id); },

  getMembers: async (projectId: string): Promise<ProjectMember[]> =>
    (await api.get('/projects/' + projectId + '/members')).data.data,
  addMember: async (projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> =>
    (await api.post('/projects/' + projectId + '/members', { userId, role })).data.data,
  updateMemberRole: async (projectId: string, userId: string, role: ProjectRole): Promise<ProjectMember> =>
    (await api.patch('/projects/' + projectId + '/members/' + userId, { role })).data.data,
  removeMember: async (projectId: string, userId: string): Promise<void> => {
    await api.delete('/projects/' + projectId + '/members/' + userId);
  },

  getColumns: async (projectId: string): Promise<KanbanColumn[]> =>
    (await api.get('/projects/' + projectId + '/columns')).data.data,
  createColumn: async (projectId: string, data: { name: string; color?: string }): Promise<KanbanColumn> =>
    (await api.post('/projects/' + projectId + '/columns', data)).data.data,
  updateColumn: async (projectId: string, columnId: string, data: Partial<KanbanColumn>): Promise<KanbanColumn> =>
    (await api.patch('/projects/' + projectId + '/columns/' + columnId, data)).data.data,
  deleteColumn: async (projectId: string, columnId: string): Promise<void> => {
    await api.delete('/projects/' + projectId + '/columns/' + columnId);
  },

  getTags: async (projectId: string): Promise<Tag[]> =>
    (await api.get('/projects/' + projectId + '/tags')).data.data,
};
