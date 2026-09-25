import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../api/tasksApi';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate, dueDateLabel, isOverdue } from '../../utils/dateUtils';
import { keys } from '../../constants/queryKeys';
import { cn } from '../../utils/cn';
import { CommentList } from '../comments/CommentList';
import { FileAttachments } from '../files/FileAttachments';
import { TaskTimer } from '../timeTracking/TaskTimer';
import { TaskDependencies } from './TaskDependencies';
import { TaskTags } from './TaskTags';
import { STATUS_COLOR } from '../../constants/taskStyles';

const TABS = [
  { id: 'details', label: 'Details', icon: 'ph:list-bullets-duotone' },
  { id: 'comments', label: 'Comments', icon: 'ph:chat-circle-dots-duotone' },
  { id: 'files', label: 'Files', icon: 'ph:paperclip-duotone' },
  { id: 'time', label: 'Time', icon: 'ph:timer-duotone' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** Slide-over that hosts everything attached to a task: comments, files, time and dependencies. */
export function TaskDetailPanel({
  taskId,
  projectId,
  onClose,
}: {
  taskId: string;
  projectId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>('details');
  const [newSubtask, setNewSubtask] = useState('');
  const queryClient = useQueryClient();
  const { canEdit } = usePermissions(projectId);

  const { data: task, isLoading } = useQuery({
    queryKey: keys.tasks.detail(taskId),
    queryFn: () => tasksApi.get(taskId),
  });

  const { data: subtasks = [] } = useQuery({
    queryKey: keys.tasks.subtasks(taskId),
    queryFn: () => tasksApi.getSubtasks(taskId),
  });

  const invalidateSubtasks = () => {
    queryClient.invalidateQueries({ queryKey: keys.tasks.subtasks(taskId) });
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
  };

  const { mutate: addSubtask, isPending: isAddingSubtask } = useMutation({
    mutationFn: (title: string) => tasksApi.createSubtask(taskId, { title }),
    onSuccess: () => {
      setNewSubtask('');
      invalidateSubtasks();
    },
  });

  const { mutate: toggleSubtask } = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      tasksApi.update(id, { status: done ? 'DONE' : 'TODO' }),
    onSuccess: invalidateSubtasks,
  });

  const doneSubtasks = subtasks.filter((s) => s.status === 'DONE').length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <aside className="relative w-full max-w-lg h-full overflow-y-auto bg-raised shadow-modal flex flex-col">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-hairline px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {isLoading ? (
                <div className="h-5 w-48 bg-black/10 rounded animate-pulse" />
              ) : (
                <h2 className="text-lg font-semibold text-ink leading-snug">{task?.title}</h2>
              )}
              {task && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={cn('badge text-xs', STATUS_COLOR[task.status])}>
                    {task.status.replace('_', ' ')}
                  </span>
                  <span className="badge text-xs bg-black/[0.05] text-ink-muted">{task.priority}</span>
                  {task.dueDate && (
                    <span
                      className={cn(
                        'text-xs',
                        isOverdue(task.dueDate) && task.status !== 'DONE'
                          ? 'text-red-500 font-medium'
                          : 'text-ink-muted',
                      )}
                    >
                      {dueDateLabel(task.dueDate)}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn-ghost p-2 shrink-0" aria-label="Close panel">
              <Icon icon="ph:x" width={18} />
            </button>
          </div>

          <nav className="mt-4 flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  tab === t.id ? 'bg-primary text-white' : 'text-ink-muted hover:bg-black/[0.04]',
                )}
              >
                <Icon icon={t.icon} width={14} />
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 px-5 py-5 space-y-6">
          {tab === 'details' && task && (
            <>
              <div>
                <h3 className="text-sm font-semibold text-ink mb-1.5">Description</h3>
                <p className="text-sm text-ink whitespace-pre-wrap">
                  {task.description || <span className="text-ink-muted">No description.</span>}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-muted">Assignee</dt>
                  <dd className="text-ink">{task.assignee?.displayName ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Created by</dt>
                  <dd className="text-ink">{task.creator?.displayName ?? '-'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Start date</dt>
                  <dd className="text-ink">{formatDate(task.startDate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-muted">Estimate</dt>
                  <dd className="text-ink">{task.estimatedHrs ? task.estimatedHrs + 'h' : '-'}</dd>
                </div>
              </dl>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon icon="ph:tree-structure-duotone" width={18} className="text-ink-muted" />
                  <h3 className="text-sm font-semibold text-ink">
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="text-ink-muted font-normal">
                        {' '}
                        ({doneSubtasks}/{subtasks.length})
                      </span>
                    )}
                  </h3>
                </div>

                {subtasks.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleSubtask({ id: s.id, done: s.status !== 'DONE' })}
                    disabled={!canEdit}
                    className="flex w-full items-center gap-2 text-left text-sm py-0.5 disabled:cursor-default"
                  >
                    <Icon
                      icon={s.status === 'DONE' ? 'ph:check-circle-fill' : 'ph:circle'}
                      width={16}
                      className={cn('shrink-0', s.status === 'DONE' ? 'text-emerald-500' : 'text-ink-muted')}
                    />
                    <span className={cn('truncate', s.status === 'DONE' ? 'line-through text-ink-muted' : 'text-ink')}>
                      {s.title}
                    </span>
                  </button>
                ))}

                {canEdit && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newSubtask.trim()) addSubtask(newSubtask.trim());
                    }}
                    className="flex gap-2 pt-1"
                  >
                    <input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Add a subtask..."
                      className="input text-sm py-1.5"
                    />
                    <button
                      type="submit"
                      disabled={!newSubtask.trim() || isAddingSubtask}
                      className="btn-secondary text-sm px-3 py-1.5"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>

              <TaskTags taskId={taskId} projectId={projectId} tags={task?.tags ?? []} canEdit={canEdit} />

              <TaskDependencies taskId={taskId} projectId={projectId} canEdit={canEdit} />
            </>
          )}

          {tab === 'comments' && <CommentList taskId={taskId} />}
          {tab === 'files' && <FileAttachments taskId={taskId} />}
          {tab === 'time' && <TaskTimer taskId={taskId} taskTitle={task?.title ?? ''} />}
        </div>
      </aside>
    </div>
  );
}
