export const SOCKET_EVENTS = {
  TASK_CREATED: 'task:created', TASK_UPDATED: 'task:updated', TASK_DELETED: 'task:deleted',
  TASK_MOVED: 'task:moved', COMMENT_CREATED: 'comment:created', COLUMN_UPDATED: 'column:updated',
  NOTIFICATION_NEW: 'notification:new', TIMER_CONFLICT: 'timer:conflict',
} as const;
