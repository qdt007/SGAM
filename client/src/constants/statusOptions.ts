import { TaskStatus, Priority, ProjectStatus } from '../types';
export const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string; color: string }> = [
  { value: 'BACKLOG', label: 'Backlog', color: 'bg-gray-400' },
  { value: 'TODO', label: 'To Do', color: 'bg-blue-400' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-400' },
  { value: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-400' },
  { value: 'DONE', label: 'Done', color: 'bg-green-400' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-400' },
];
export const PRIORITY_OPTIONS: Array<{ value: Priority; label: string; color: string; icon: string }> = [
  { value: 'CRITICAL', label: 'Critical', color: 'text-red-600', icon: 'C' },
  { value: 'HIGH', label: 'High', color: 'text-orange-500', icon: 'H' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-500', icon: 'M' },
  { value: 'LOW', label: 'Low', color: 'text-green-500', icon: 'L' },
];
export const PROJECT_STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string; color: string }> = [
  { value: 'PLANNING', label: 'Planning', color: 'bg-gray-200 text-gray-700' },
  { value: 'ACTIVE', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-blue-100 text-blue-700' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
];
