import api from './axiosClient';
import { FileAttachment } from '../types';

export const filesApi = {
  listByTask: async (taskId: string): Promise<FileAttachment[]> =>
    (await api.get('/tasks/' + taskId + '/files')).data.data,
  listByProject: async (projectId: string): Promise<FileAttachment[]> =>
    (await api.get('/projects/' + projectId + '/files')).data.data,
  upload: async (taskId: string, files: File[], onProgress?: (pct: number) => void): Promise<FileAttachment[]> => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    const res = await api.post('/tasks/' + taskId + '/files', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return res.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete('/files/' + id);
  },
};
