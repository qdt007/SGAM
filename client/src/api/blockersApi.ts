import api from './axiosClient';
import { BlockerImpact, BlockerStatus, TaskStatus } from '../types';

export interface BlockerPerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface Blocker {
  id: string;
  projectId: string;
  taskId: string | null;
  title: string;
  description: string | null;
  impact: BlockerImpact;
  status: BlockerStatus;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  raisedBy: BlockerPerson;
  resolvedBy: BlockerPerson | null;
  task: { id: string; title: string; status: TaskStatus } | null;
}

export interface BlockerList {
  /** Open ones first, worst impact first; resolved ones after, newest first. */
  blockers: Blocker[];
  counts: { open: number; resolved: number; blocking: number };
}

export interface CreateBlockerPayload {
  title: string;
  description?: string;
  impact?: BlockerImpact;
  taskId?: string | null;
}

export const blockersApi = {
  list: async (projectId: string, status?: BlockerStatus): Promise<BlockerList> =>
    (await api.get(`/projects/${projectId}/blockers`, { params: status ? { status } : undefined })).data.data,

  create: async (projectId: string, data: CreateBlockerPayload): Promise<Blocker> =>
    (await api.post(`/projects/${projectId}/blockers`, data)).data.data,

  update: async (id: string, data: Partial<CreateBlockerPayload>): Promise<Blocker> =>
    (await api.patch(`/blockers/${id}`, data)).data.data,

  resolve: async (id: string, resolution?: string): Promise<Blocker> =>
    (await api.post(`/blockers/${id}/resolve`, { ...(resolution && { resolution }) })).data.data,

  reopen: async (id: string): Promise<Blocker> => (await api.post(`/blockers/${id}/reopen`)).data.data,

  remove: async (id: string): Promise<{ id: string }> => (await api.delete(`/blockers/${id}`)).data.data,
};

/** How each impact level reads and looks. Worst first, matching the server's sort. */
export const IMPACT_META: Record<BlockerImpact, { label: string; badge: string; icon: string }> = {
  BLOCKING: {
    label: 'Đang chặn',
    badge: 'bg-danger/10 text-danger',
    icon: 'ph:warning-octagon-duotone',
  },
  SERIOUS: {
    label: 'Nghiêm trọng',
    badge: 'bg-warning/10 text-warning',
    icon: 'ph:warning-duotone',
  },
  MINOR: {
    label: 'Nhỏ',
    badge: 'bg-ink/[0.06] text-ink-muted',
    icon: 'ph:info-duotone',
  },
};
