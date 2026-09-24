import api from './axiosClient';
import { Comment } from '../types';

export const commentsApi = {
  listByTask: async (taskId: string): Promise<Comment[]> => (await api.get('/tasks/' + taskId + '/comments')).data.data,
  create: async (taskId: string, body: string): Promise<Comment> =>
    (await api.post('/tasks/' + taskId + '/comments', { body })).data.data,
  update: async (id: string, body: string): Promise<Comment> =>
    (await api.patch('/comments/' + id, { body })).data.data,
  delete: async (id: string): Promise<void> => {
    await api.delete('/comments/' + id);
  },
};
