import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../api/tasksApi';
import { keys } from '../../constants/queryKeys';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { SelectField } from '../ui/SelectField';

export function TaskDependencies({
  taskId,
  projectId,
  canEdit,
}: {
  taskId: string;
  projectId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: deps = [] } = useQuery({
    queryKey: keys.tasks.dependencies(taskId),
    queryFn: () => tasksApi.getDependencies(taskId),
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: keys.tasks.byProject(projectId),
    queryFn: () => tasksApi.listByProject(projectId),
    enabled: adding,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: keys.tasks.dependencies(taskId) });
    queryClient.invalidateQueries({ queryKey: ['tasks', 'dependencies', projectId] });
  };

  const { mutate: add } = useMutation({
    mutationFn: (blockingTaskId: string) => tasksApi.addDependency(taskId, blockingTaskId),
    onSuccess: () => {
      setAdding(false);
      setError(null);
      invalidate();
    },
    onError: (e: unknown) =>
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not add dependency',
      ),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (depId: string) => tasksApi.removeDependency(taskId, depId),
    onSuccess: invalidate,
  });

  const blockedBy = deps.filter((d) => d.blockedTaskId === taskId);
  const blocking = deps.filter((d) => d.blockingTaskId === taskId);
  const linkedIds = new Set(deps.flatMap((d) => [d.blockedTaskId, d.blockingTaskId]));
  const candidates = (allTasks as Task[]).filter((t) => t.id !== taskId && !linkedIds.has(t.id));

  const Row = ({
    label,
    task,
    depId,
  }: {
    label: string;
    task?: { id: string; title: string; status: string };
    depId: string;
  }) => (
    <div className="group flex items-center gap-2 text-sm py-1">
      <span className="text-xs text-ink-muted w-20 shrink-0">{label}</span>
      <span className={cn('truncate', task?.status === 'DONE' ? 'text-ink-muted line-through' : 'text-ink')}>
        {task?.title ?? 'Unknown task'}
      </span>
      {canEdit && (
        <button
          onClick={() => remove(depId)}
          className="ml-auto row-action text-ink-muted hover:text-red-500"
          aria-label="Remove dependency"
        >
          <Icon icon="ph:x" width={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="ph:graph-duotone" width={18} className="text-ink-muted" />
        <h3 className="text-sm font-semibold text-ink">Dependencies</h3>
        {canEdit && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="ml-auto text-xs text-primary hover:underline dark:text-primary"
          >
            + Add
          </button>
        )}
      </div>

      {blockedBy.length === 0 && blocking.length === 0 && !adding && (
        <p className="text-sm text-ink-muted">No dependencies.</p>
      )}

      {blockedBy.map((d) => (
        <Row key={d.id} label="Blocked by" task={d.blockingTask} depId={d.id} />
      ))}
      {blocking.map((d) => (
        <Row key={d.id} label="Blocks" task={d.blockedTask} depId={d.id} />
      ))}

      {adding && (
        <div className="space-y-1.5">
          <SelectField
            value=""
            placeholder="Select the task that blocks this one…"
            onChange={(v) => v && add(v)}
            options={candidates.map((t) => ({ value: t.id, label: t.title }))}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={() => {
              setAdding(false);
              setError(null);
            }}
            className="text-xs text-ink-muted hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
