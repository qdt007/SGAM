import api from './axiosClient';
import { BurndownReport, WorkloadReport, ProjectSummary } from '../types';

export const reportsApi = {
  summary: async (projectId: string): Promise<ProjectSummary> =>
    (await api.get('/projects/' + projectId + '/reports/summary')).data.data,
  burndown: async (projectId: string, range?: { from?: string; to?: string }): Promise<BurndownReport> =>
    (await api.get('/projects/' + projectId + '/reports/burndown', { params: range })).data.data,
  workload: async (projectId: string): Promise<WorkloadReport> =>
    (await api.get('/projects/' + projectId + '/reports/workload')).data.data,
};
