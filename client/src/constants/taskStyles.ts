import { TaskStatus, Priority, ProjectStatus } from '../types';

/**
 * Every status and priority chip resolves here, so one state never appears in
 * two colours on two screens.
 *
 * Ember Studio reserves terracotta for interactive elements, so status chips use
 * the neutral stone tint plus the documented success / warning / error hues only
 * where the state genuinely carries that meaning.
 */

export const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export const STATUS_BADGE: Record<string, string> = {
  BACKLOG: 'badge badge-neutral',
  TODO: 'badge badge-neutral',
  IN_PROGRESS: 'badge badge-amber',
  IN_REVIEW: 'badge badge-warning',
  DONE: 'badge badge-success',
  CANCELLED: 'badge badge-neutral line-through',
};

/** Solid dots for dense rows where a chip would be too loud. */
export const STATUS_DOT: Record<string, string> = {
  BACKLOG: 'bg-ink-subtle/50',
  TODO: 'bg-ink-subtle',
  IN_PROGRESS: 'bg-accent',
  IN_REVIEW: 'bg-warning',
  DONE: 'bg-success',
  CANCELLED: 'bg-ink-subtle/40',
};

export const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const PRIORITY_BADGE: Record<string, string> = {
  CRITICAL: 'badge badge-danger',
  HIGH: 'badge badge-warning',
  MEDIUM: 'badge badge-neutral',
  LOW: 'badge badge-neutral',
};

export const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-danger',
  HIGH: 'bg-warning',
  MEDIUM: 'bg-ink-subtle',
  LOW: 'bg-ink-subtle/50',
};

export const PROJECT_STATUS_BADGE: Record<string, string> = {
  PLANNING: 'badge badge-neutral',
  ACTIVE: 'badge badge-success',
  ON_HOLD: 'badge badge-warning',
  COMPLETED: 'badge badge-neutral',
  CANCELLED: 'badge badge-neutral line-through',
};

export const TASK_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
export const PRIORITIES: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

/* Names kept from the previous system so existing markup keeps resolving. */
export const STATUS_COLOR = STATUS_BADGE;
export const PRIORITY_COLOR = PRIORITY_BADGE;
