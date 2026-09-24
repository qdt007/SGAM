import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { PRIORITY_DOT } from './kanbanColumns';

interface TaskCardProps {
  task: Task;
  projectId: string;
  isDragging?: boolean;
  onOpen?: (taskId: string) => void;
}

export function TaskCard({ task, projectId, isDragging, onOpen }: TaskCardProps) {
  const qc = useQueryClient();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border bg-raised p-3 shadow-sm transition-all duration-150',
        isDragging
          ? 'opacity-40 border-primary/40 dark:border-primary-700 scale-95'
          : 'border-line hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800',
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          {...listeners}
          {...attributes}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-ink-subtle/70 hover:text-ink-muted dark:hover:text-ink-subtle transition-colors touch-none"
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>

        <button
          type="button"
          onClick={() => onOpen?.(task.id)}
          className="text-sm font-medium leading-snug flex-1 min-w-0 text-left hover:text-primary transition-colors"
        >
          {task.title}
        </button>

        <button
          onClick={() => deleteMutation.mutate()}
          className="opacity-0 group-hover:opacity-100 text-ink-subtle/70 hover:text-red-500 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {task.description && <p className="text-xs text-ink-muted mt-1.5 line-clamp-2 ml-5">{task.description}</p>}

      <div className="mt-2.5 ml-5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])} />
          <span className="text-xs text-ink-muted">{task.priority}</span>
        </div>
        <div className="flex items-center gap-2">
          {!!task._count?.comments && (
            <span
              className="text-xs text-ink-subtle inline-flex items-center gap-0.5"
              title={task._count.comments + ' comments'}
            >
              <MessageSquare size={11} />
              {task._count.comments}
            </span>
          )}
          {task.dueDate && (
            <span
              className={cn(
                'text-xs',
                new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                  ? 'text-red-500 font-medium'
                  : 'text-ink-subtle',
              )}
            >
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.assignee && (
            <div
              className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white text-xs shrink-0"
              title={task.assignee.displayName}
            >
              {task.assignee.displayName?.[0]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Drag overlay card (floating while dragging) ───────────── */
export function DragOverlayCard({ task }: { task: Task }) {
  return (
    <div className="rounded-xl border-2 border-primary-400 dark:border-primary bg-raised p-3 shadow-2xl rotate-2 cursor-grabbing w-64 opacity-95">
      <div className="flex items-start gap-2">
        <GripVertical size={14} className="mt-0.5 text-primary-400 shrink-0" />
        <p className="text-sm font-semibold leading-snug flex-1">{task.title}</p>
      </div>
      {task.description && <p className="text-xs text-ink-subtle mt-1.5 line-clamp-1 ml-5">{task.description}</p>}
      <div className="mt-2 ml-5 flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[task.priority])} />
        <span className="text-xs text-ink-muted">{task.priority}</span>
      </div>
    </div>
  );
}

/* ─── Droppable column ──────────────────────────────────────── */
