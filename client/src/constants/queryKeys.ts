export const keys = {
  auth: { me: ['auth', 'me'] as const },
  users: {
    all: ['users'] as const,
    notificationPrefs: ['users', 'me', 'notification-prefs'] as const,
    search: (q: string) => ['users', 'search', q] as const,
    detail: (id: string) => ['users', id] as const,
  },
  projects: {
    all: ['projects'] as const,
    detail: (id: string) => ['projects', id] as const,
    members: (id: string) => ['projects', id, 'members'] as const,
    columns: (id: string) => ['projects', id, 'columns'] as const,
    tags: (id: string) => ['projects', id, 'tags'] as const,
    files: (id: string) => ['projects', id, 'files'] as const,
    comments: (id: string) => ['projects', id, 'comments'] as const,
  },
  tasks: {
    byProject: (pid: string, f?: Record<string, unknown>) =>
      f ? ['tasks', 'list', pid, f] : (['tasks', 'list', pid] as const),
    detail: (id: string) => ['tasks', 'detail', id] as const,
    subtasks: (id: string) => ['tasks', id, 'subtasks'] as const,
    comments: (id: string) => ['tasks', id, 'comments'] as const,
    files: (id: string) => ['tasks', id, 'files'] as const,
    timeLogs: (id: string) => ['tasks', id, 'timeLogs'] as const,
    dependencies: (id: string) => ['tasks', id, 'dependencies'] as const,
  },
  notifications: { all: ['notifications'] as const, unread: ['notifications', 'unread'] as const },
  reports: {
    summary: (pid: string) => ['reports', pid, 'summary'] as const,
    progress: (pid: string) => ['reports', pid, 'progress'] as const,
    burndown: (pid: string) => ['reports', pid, 'burndown'] as const,
    workload: (pid: string) => ['reports', pid, 'workload'] as const,
    overdue: (pid: string) => ['reports', pid, 'overdue'] as const,
    dashboard: ['reports', 'dashboard'] as const,
  },
} as const;
