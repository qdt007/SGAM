import api from './axiosClient';
import { Task, TaskDependency } from '../types';

export interface TaskFilters {
  status?: string;
  assigneeId?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const tasksApi = {
  listByProject: async (projectId: string, filters?: TaskFilters): Promise<Task[]> =>
    (await api.get('/projects/' + projectId + '/tasks', { params: filters })).data.data,
  create: async (projectId: string, data: Partial<Task>): Promise<Task> =>
    (await api.post('/projects/' + projectId + '/tasks', data)).data.data,
  get: async (id: string): Promise<Task> => (await api.get('/tasks/' + id)).data.data,
  update: async (id: string, data: Partial<Task>): Promise<Task> => (await api.patch('/tasks/' + id, data)).data.data,
  delete: async (id: string): Promise<void> => {
    await api.delete('/tasks/' + id);
  },
  move: async (id: string, data: { columnId: string; order: number }): Promise<Task> =>
    (await api.patch('/tasks/' + id + '/move', data)).data.data,

  setTags: async (taskId: string, tagIds: string[]): Promise<Task> =>
    (await api.put('/tasks/' + taskId + '/tags', { tagIds })).data.data,
  getSubtasks: async (taskId: string): Promise<Task[]> => (await api.get('/tasks/' + taskId + '/subtasks')).data.data,
  createSubtask: async (taskId: string, data: Partial<Task>): Promise<Task> =>
    (await api.post('/tasks/' + taskId + '/subtasks', data)).data.data,

  listProjectDependencies: async (projectId: string): Promise<TaskDependency[]> =>
    (await api.get('/projects/' + projectId + '/tasks/dependencies')).data.data,
  getDependencies: async (taskId: string): Promise<TaskDependency[]> =>
    (await api.get('/tasks/' + taskId + '/dependencies')).data.data,
  addDependency: async (taskId: string, blockingTaskId: string): Promise<TaskDependency> =>
    (await api.post('/tasks/' + taskId + '/dependencies', { blockingTaskId })).data.data,
  removeDependency: async (taskId: string, depId: string): Promise<void> => {
    await api.delete('/tasks/' + taskId + '/dependencies/' + depId);
  },
};
