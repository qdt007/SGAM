import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { dueDateLabel, isOverdue } from '../../utils/dateUtils';
import { STATUS_LABEL, STATUS_BADGE, PRIORITY_DOT, PRIORITY_LABEL } from '../../constants/taskStyles';
import { EditTaskModal } from './EditTaskModal';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/Modal';

export function TaskRow({
  task,
  projectId,
  onOpen,
}: {
  task: Task;
  projectId: string;
  onOpen: (taskId: string) => void;
}) {
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const isDone = task.status === 'DONE';
  const late = !isDone && task.status !== 'CANCELLED' && isOverdue(task.dueDate);

  const toggleDone = useMutation({
    mutationFn: () => tasksApi.update(task.id, { status: isDone ? 'TODO' : 'DONE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return (
    <>
      <div className={cn('list-row group', isDone && 'opacity-65')}>
        <button
          onClick={() => toggleDone.mutate()}
          disabled={toggleDone.isPending}
          aria-label={isDone ? `Reopen ${task.title}` : `Mark ${task.title} complete`}
          className={cn(
            'shrink-0 rounded-full transition-colors duration-150',
            isDone ? 'text-success' : 'text-ink-subtle hover:text-primary',
          )}
        >
          <Icon icon={isDone ? 'ph:check-circle-fill' : 'ph:circle'} width={19} aria-hidden />
        </button>

        <button onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              'block truncate text-base font-medium text-ink transition-colors group-hover:text-primary',
              isDone && 'text-ink-muted line-through',
            )}
          >
            {task.title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
            <span className="inline-flex items-center gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_DOT[task.priority])} aria-hidden />
              {PRIORITY_LABEL[task.priority]}
            </span>
            {task.dueDate && (
              <span className={cn('inline-flex items-center gap-1', late && 'font-medium text-danger')}>
                <Icon icon="ph:calendar-blank" width={12} aria-hidden />
                {dueDateLabel(task.dueDate)}
              </span>
            )}
            {!!task._count?.comments && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="ph:chat-circle" width={12} aria-hidden />
                {task._count.comments}
              </span>
            )}
            {!!task._count?.subtasks && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="ph:tree-structure" width={12} aria-hidden />
                {task._count.subtasks}
              </span>
            )}
            {task.tags?.slice(0, 3).map((t) => (
              <span
                key={t.tagId}
                className="rounded-full px-1.5 py-0.5 text-2xs font-medium"
                style={{ backgroundColor: `${t.tag.color}1a`, color: t.tag.color }}
              >
                {t.tag.name}
              </span>
            ))}
            {(task.tags?.length ?? 0) > 3 && <span>+{(task.tags?.length ?? 0) - 3}</span>}
          </span>
        </button>

        <span className={cn('hidden shrink-0 md:inline-flex', STATUS_BADGE[task.status])}>
          {STATUS_LABEL[task.status]}
        </span>

        {task.assignee ? (
          <span className="hidden shrink-0 sm:block" title={task.assignee.displayName}>
            <Avatar name={task.assignee.displayName} src={task.assignee.avatarUrl} size="xs" />
          </span>
        ) : (
          <span
            className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dashed border-line-strong text-ink-subtle sm:flex"
            title="Unassigned"
          >
            <Icon icon="ph:user" width={12} aria-hidden />
          </span>
        )}

        <span className="flex shrink-0 items-center gap-0.5 row-action">
          <button onClick={() => setShowEdit(true)} className="btn-ghost btn-icon-sm" aria-label={`Edit ${task.title}`}>
            <Icon icon="ph:pencil-simple" width={15} aria-hidden />
          </button>
          <button
            onClick={() => setShowDelete(true)}
            disabled={deleteTask.isPending}
            className="btn-quiet-danger btn-icon-sm"
            aria-label={`Delete ${task.title}`}
          >
            <Icon icon="ph:trash" width={15} aria-hidden />
          </button>
        </span>
      </div>

      {showEdit && <EditTaskModal task={task} projectId={projectId} onClose={() => setShowEdit(false)} />}
      {showDelete && (
        <ConfirmDialog
          title={`Delete "${task.title}"?`}
          message="Its comments, attachments, time logs and subtasks go with it. This cannot be undone."
          confirmLabel="Delete task"
          loading={deleteTask.isPending}
          onConfirm={() => deleteTask.mutate(undefined, { onSuccess: () => setShowDelete(false) })}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
