import { Priority, TaskStatus, ProjectStatus } from '../types';
export const priorityColors: Record<Priority, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  MEDIUM: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  LOW: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
};
export const taskStatusColors: Record<TaskStatus, { bg: string; text: string }> = {
  BACKLOG: { bg: 'bg-gray-100', text: 'text-gray-600' },
  TODO: { bg: 'bg-blue-100', text: 'text-blue-600' },
  IN_PROGRESS: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  IN_REVIEW: { bg: 'bg-purple-100', text: 'text-purple-700' },
  DONE: { bg: 'bg-green-100', text: 'text-green-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-600' },
};
export const projectStatusColors: Record<ProjectStatus, { bg: string; text: string }> = {
  PLANNING: { bg: 'bg-gray-100', text: 'text-gray-700' },
  ACTIVE: { bg: 'bg-green-100', text: 'text-green-700' },
  ON_HOLD: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  COMPLETED: { bg: 'bg-blue-100', text: 'text-blue-700' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
};
