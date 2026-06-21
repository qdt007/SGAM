import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, X, List } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';

const COLUMNS = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-gray-400', light: 'bg-gray-50 dark:bg-gray-900' },
  { id: 'TODO', label: 'To Do', color: 'bg-blue-400', light: 'bg-blue-50 dark:bg-blue-950/30' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-400', light: 'bg-yellow-50 dark:bg-yellow-950/30' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-400', light: 'bg-purple-50 dark:bg-purple-950/30' },
  { id: 'DONE', label: 'Done', color: 'bg-green-400', light: 'bg-green-50 dark:bg-green-950/30' },
];

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-green-400',
};

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
});
type CreateTaskForm = z.infer<typeof createTaskSchema>;

function AddCardForm({ projectId, status, onClose }: { projectId: string; status: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: 'MEDIUM' },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateTaskForm) =>
      tasksApi.create(projectId, { ...data, status: status as Task['status'] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onClose();
    },
  });

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm space-y-2">
      <input
        {...register('title')}
        autoFocus
        placeholder="Task title..."
        className="input text-sm py-1.5"
      />
      {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
      <select {...register('priority')} className="input text-xs py-1">
        <option value="LOW">Low</option>
        <option value="MEDIUM">Medium</option>
        <option value="HIGH">High</option>
        <option value="CRITICAL">Critical</option>
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="btn-primary text-xs py-1 flex-1 justify-center">
          {isSubmitting ? 'Adding...' : 'Add'}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost p-1"><X size={14} /></button>
      </div>
    </form>
  );
}

function TaskCard({ task, projectId }: { task: Task; projectId: string }) {
  const qc = useQueryClient();
  const [showMove, setShowMove] = useState(false);

  const moveMutation = useMutation({
    mutationFn: (newStatus: string) => tasksApi.update(task.id, { status: newStatus as Task['status'] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      setShowMove(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  return (
    <div className="group rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium dark:text-white leading-snug flex-1">{task.title}</p>
        <button
          onClick={() => deleteMutation.mutate()}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority])} title={task.priority} />
          <span className="text-xs text-gray-500">{task.priority}</span>
        </div>
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className={cn('text-xs', new Date(task.dueDate) < new Date() && task.status !== 'DONE' ? 'text-red-500 font-medium' : 'text-gray-400')}>
              {format(new Date(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.assignee && (
            <div className="h-5 w-5 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs shrink-0" title={task.assignee.displayName}>
              {task.assignee.displayName?.[0]}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        {showMove ? (
          <div className="flex gap-1 flex-wrap">
            {COLUMNS.filter((c) => c.id !== task.status).map((col) => (
              <button
                key={col.id}
                onClick={() => moveMutation.mutate(col.id)}
                className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-primary-100 dark:hover:bg-primary-900/40 text-gray-600 dark:text-gray-300 transition-colors"
              >
                {col.label}
              </button>
            ))}
            <button onClick={() => setShowMove(false)} className="text-xs px-2 py-0.5 rounded text-gray-400 hover:text-gray-600">cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowMove(true)}
            className="text-xs text-gray-400 hover:text-primary-600 transition-colors"
          >
            Move →
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [addingTo, setAddingTo] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.listByProject(projectId!),
    enabled: !!projectId,
  });

  const tasksByStatus = COLUMNS.reduce<Record<string, Task[]>>((acc, col) => {
    acc[col.id] = tasks.filter((t) => t.status === col.id);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
        <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1">
          <ChevronLeft size={14} /> {project?.name ?? 'Project'}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold dark:text-white">Kanban Board</span>
        <Link to={`/projects/${projectId}`} className="ml-auto btn-ghost text-xs py-1 gap-1">
          <List size={13} /> List view
        </Link>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-3 h-full min-w-max">
            {COLUMNS.map((col) => {
              const colTasks = tasksByStatus[col.id] ?? [];
              return (
                <div key={col.id} className="flex flex-col w-64 shrink-0">
                  <div className="flex items-center gap-2 mb-2.5 px-1">
                    <span className={cn('h-2.5 w-2.5 rounded-full', col.color)} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{col.label}</span>
                    <span className="ml-auto text-xs text-gray-400 font-medium">{colTasks.length}</span>
                  </div>

                  <div className={cn('flex-1 rounded-xl p-2 space-y-2 overflow-y-auto min-h-32', col.light)}>
                    {colTasks.map((task) => (
                      <TaskCard key={task.id} task={task} projectId={projectId!} />
                    ))}

                    {addingTo === col.id ? (
                      <AddCardForm
                        projectId={projectId!}
                        status={col.id}
                        onClose={() => setAddingTo(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingTo(col.id)}
                        className="w-full flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-2 px-1 rounded-lg hover:bg-white/60 dark:hover:bg-gray-800/60 transition-colors"
                      >
                        <Plus size={13} /> Add task
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
