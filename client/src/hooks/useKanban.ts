import { useState, useCallback } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasksApi';
import { keys } from '../constants/queryKeys';
import { Task } from '../types';

export function useKanban(projectId: string) {
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveTask((event.active.data.current?.task as Task) ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveTask(null);
      if (!over) return;

      const draggedTask = active.data.current?.task as Task;
      const overColumnId = over.data.current?.columnId as string;
      if (!draggedTask || !overColumnId || draggedTask.columnId === overColumnId) return;

      const tasksQueryKey = keys.tasks.byProject(projectId);
      const previousTasks = queryClient.getQueryData<Task[]>(tasksQueryKey);

      // Optimistic update
      queryClient.setQueryData<Task[]>(tasksQueryKey, (old = []) =>
        old.map((t) => (t.id === draggedTask.id ? { ...t, columnId: overColumnId } : t))
      );

      try {
        setIsMoving(true);
        const columnTasks = (previousTasks || [])
          .filter((t) => t.columnId === overColumnId && t.id !== draggedTask.id)
          .sort((a, b) => a.order - b.order);
        const last = columnTasks[columnTasks.length - 1];
        await tasksApi.move(draggedTask.id, {
          columnId: overColumnId,
          order: last ? last.order + 1000 : 1000,
        });
        await queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      } catch {
        queryClient.setQueryData(tasksQueryKey, previousTasks);
      } finally {
        setIsMoving(false);
      }
    },
    [projectId, queryClient]
  );

  return { activeTask, isMoving, handleDragStart, handleDragEnd };
}
