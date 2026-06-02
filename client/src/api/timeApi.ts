import api from './axiosClient';
import { TimeLog } from '../types';

export const timeApi = {
  startTimer: async (taskId: string): Promise<TimeLog> =>
    (await api.post('/tasks/' + taskId + '/time/start')).data.data,
  stopTimer: async (taskId: string, timeLogId: string): Promise<TimeLog> =>
    (await api.post('/tasks/' + taskId + '/time/stop', { timeLogId })).data.data,
  logManual: async (
    taskId: string,
    data: { startedAt: string; endedAt: string; note?: string }
  ): Promise<TimeLog> => (await api.post('/tasks/' + taskId + '/time', data)).data.data,
  listByTask: async (taskId: string): Promise<TimeLog[]> =>
    (await api.get('/tasks/' + taskId + '/time')).data.data,
  update: async (id: string, data: Partial<TimeLog>): Promise<TimeLog> =>
    (await api.patch('/time/' + id, data)).data.data,
  delete: async (id: string): Promise<void> => {
    await api.delete('/time/' + id);
  },
};
