import api from './axiosClient';
import { ProjectProgress, BurndownPoint, WorkloadItem, Task } from '../types';
export const reportsApi = {
  getProgress: async (projectId: string): Promise<ProjectProgress[]> => (await api.get("/projects/" + projectId + "/reports/progress")).data.data,
  getBurndown: async (projectId: string): Promise<BurndownPoint[]> => (await api.get("/projects/" + projectId + "/reports/burndown")).data.data,
  getWorkload: async (projectId: string): Promise<WorkloadItem[]> => (await api.get("/projects/" + projectId + "/reports/workload")).data.data,
  getOverdue: async (projectId: string): Promise<Task[]> => (await api.get("/projects/" + projectId + "/reports/overdue")).data.data,
  getDashboard: async () => (await api.get("/reports/dashboard")).data.data,
};
