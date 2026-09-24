import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket';
import { keys } from '../constants/queryKeys';

const TASK_EVENTS = ['task:created', 'task:updated', 'task:deleted', 'task:moved'] as const;
const PROJECT_EVENTS = [
  'project:updated',
  'member:added',
  'member:updated',
  'member:removed',
  'column:updated',
] as const;

/**
 * Joins the project's socket room and refreshes the cached queries when anyone
 * changes something. Mount it once per project screen (board, list, gantt).
 */
export function useProjectRealtime(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const { socket, joinProject, leaveProject, on, off } = useSocket();

  useEffect(() => {
    if (!projectId || !socket) return;
    joinProject(projectId);
    return () => leaveProject(projectId);
  }, [projectId, socket, joinProject, leaveProject]);

  useEffect(() => {
    if (!projectId || !socket) return;

    const refreshTasks = () => {
      // The list query is keyed with an optional filter object, so invalidate the prefix.
      queryClient.invalidateQueries({ queryKey: ['tasks', 'list', projectId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: keys.reports.summary(projectId) });
    };

    const refreshProject = () => {
      queryClient.invalidateQueries({ queryKey: keys.projects.detail(projectId) });
      queryClient.invalidateQueries({ queryKey: keys.projects.members(projectId) });
      queryClient.invalidateQueries({ queryKey: keys.projects.columns(projectId) });
    };

    TASK_EVENTS.forEach((e) => on(e, refreshTasks));
    PROJECT_EVENTS.forEach((e) => on(e, refreshProject));
    return () => {
      TASK_EVENTS.forEach((e) => off(e, refreshTasks));
      PROJECT_EVENTS.forEach((e) => off(e, refreshProject));
    };
  }, [projectId, socket, on, off, queryClient]);
}
