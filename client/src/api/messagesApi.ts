import api from './axiosClient';

export interface MessageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface MessageMention {
  mentionedId: string;
  mentioned: { id: string; username: string; displayName: string };
}

export interface Message {
  id: string;
  body: string;
  pinned: boolean;
  projectId: string;
  authorId: string;
  editedAt: string | null;
  createdAt: string;
  author: MessageAuthor;
  mentions: MessageMention[];
}

export interface MessagePage {
  /** Oldest first — reading order. */
  messages: Message[];
  hasMore: boolean;
}

export const messagesApi = {
  /** `before` is the id of the oldest message on screen, for loading older history. */
  list: async (projectId: string, before?: string, limit?: number): Promise<MessagePage> =>
    (
      await api.get(`/projects/${projectId}/messages`, {
        params: { ...(before && { before }), ...(limit && { limit }) },
      })
    ).data.data,

  pinned: async (projectId: string): Promise<Message[]> =>
    (await api.get(`/projects/${projectId}/messages/pinned`)).data.data,

  send: async (projectId: string, body: string, pinned?: boolean): Promise<Message> =>
    (await api.post(`/projects/${projectId}/messages`, { body, ...(pinned && { pinned }) })).data.data,

  update: async (id: string, data: { body?: string; pinned?: boolean }): Promise<Message> =>
    (await api.patch(`/messages/${id}`, data)).data.data,

  remove: async (id: string): Promise<{ id: string }> => (await api.delete(`/messages/${id}`)).data.data,
};
