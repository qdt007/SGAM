import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, ChevronLeft, KanbanSquare, Trash2, CheckCircle2, Circle, BarChart3, Calendar, Pencil } from 'lucide-react';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';
import { Task } from '../../types';

const STATUS_LABEL: Record<string, string> = { BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done', CANCELLED: 'Cancelled' };
const PRIORITY_COLOR: Record<string, string> = { CRITICAL: 'text-red-600 bg-red-50 dark:bg-red-900/20', HIGH: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20', MEDIUM: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20', LOW: 'text-green-600 bg-green-50 dark:bg-green-900/20' };
const STATUS_COLOR: Record<string, string> = { BACKLOG: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', TODO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', IN_PROGRESS: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300', IN_REVIEW: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', DONE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']).optional(),
  dueDate: z.string().optional(),
  estimatedHrs: z.number().positive().optional().nullable(),
});
type CreateTaskForm = z.infer<typeof createTaskSchema>;

function CreateTaskModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { status: 'TODO', priority: 'MEDIUM' },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.create(projectId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['projects'] }); onClose(); },
  });

  const onSubmit = (data: CreateTaskForm) => {
    mutation.mutate({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg dark:text-white">New Task</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mutation.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong'}
            </div>
          )}

          <div>
            <label className="label">Task title *</label>
            <input {...register('title')} className={cn('input', errors.title && 'border-red-400')} placeholder="What needs to be done?" />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} className="input resize-none" rows={3} placeholder="Add more details..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Due date</label>
            <input {...register('dueDate')} type="date" className="input" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTaskModal({ task, projectId, onClose }: { task: Task; projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateTaskForm>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
      estimatedHrs: task.estimatedHrs ?? undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (data: Partial<Task>) => tasksApi.update(task.id, {
      ...data,
      dueDate: (data as CreateTaskForm).dueDate ? new Date((data as CreateTaskForm).dueDate!).toISOString() : undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); onClose(); },
  });

  const onSubmit = (data: CreateTaskForm) => mutation.mutate(data as Partial<Task>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="card w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg dark:text-white">Edit Task</h2>
          <button onClick={onClose} className="btn-ghost p-1"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {mutation.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {(mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong'}
            </div>
          )}

          <div>
            <label className="label">Task title *</label>
            <input {...register('title')} className={cn('input', errors.title && 'border-red-400')} />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label">Description</label>
            <textarea {...register('description')} className="input resize-none" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Due date</label>
            <input {...register('dueDate')} type="date" className="input" />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TaskRow({ task, projectId }: { task: Task; projectId: string }) {
  const qc = useQueryClient();
  const isDone = task.status === 'DONE';
  const [showEdit, setShowEdit] = useState(false);

  const toggleDone = useMutation({
    mutationFn: () => tasksApi.update(task.id, { status: isDone ? 'TODO' : 'DONE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const deleteTask = useMutation({
    mutationFn: () => tasksApi.delete(task.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['projects'] }); },
  });

  return (
    <>
      <div className={cn('flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 group', isDone && 'opacity-60')}>
        <button onClick={() => toggleDone.mutate()} className="shrink-0 text-gray-400 hover:text-primary-600 transition-colors">
          {isDone ? <CheckCircle2 size={18} className="text-green-500" /> : <Circle size={18} />}
        </button>

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowEdit(true)}>
          <p className={cn('text-sm dark:text-white truncate', isDone && 'line-through text-gray-400')}>{task.title}</p>
          {task.description && <p className="text-xs text-gray-500 truncate mt-0.5">{task.description}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('badge text-xs', PRIORITY_COLOR[task.priority])}>{task.priority}</span>
          <span className={cn('badge text-xs', STATUS_COLOR[task.status])}>{STATUS_LABEL[task.status]}</span>
          {task.dueDate && (
            <span className="text-xs text-gray-400">{format(new Date(task.dueDate), 'MMM d')}</span>
          )}
          {task.assignee && (
            <div className="h-6 w-6 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs" title={task.assignee.displayName}>
              {task.assignee.displayName?.[0]}
            </div>
          )}
          <button onClick={() => setShowEdit(true)} className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-gray-400 hover:text-primary-600">
            <Pencil size={14} />
          </button>
          <button onClick={() => deleteTask.mutate()} className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-red-400 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {showEdit && <EditTaskModal task={task} projectId={projectId} onClose={() => setShowEdit(false)} />}
    </>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', projectId, statusFilter],
    queryFn: () => tasksApi.listByProject(projectId!, statusFilter ? { status: statusFilter } : {}),
    enabled: !!projectId,
  });

  if (projectLoading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
    </div>
  );

  if (!project) return <div className="p-6 text-gray-500">Project not found.</div>;

  const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
  const progress = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-primary-600 flex items-center gap-1">
          <ChevronLeft size={14} /> Projects
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300">{project.name}</span>
      </div>

      <div className="card">
        <div className="h-2 rounded-t-xl -mx-4 -mt-4 mb-4" style={{ backgroundColor: project.coverColor || '#6366f1' }} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold dark:text-white">{project.name}</h1>
            {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to={`/projects/${projectId}/kanban`} className="btn-secondary shrink-0 text-xs py-1.5">
              <KanbanSquare size={14} /> Kanban
            </Link>
            <Link to={`/projects/${projectId}/gantt`} className="btn-secondary shrink-0 text-xs py-1.5">
              <Calendar size={14} /> Gantt
            </Link>
            <Link to={`/projects/${projectId}/reports`} className="btn-secondary shrink-0 text-xs py-1.5">
              <BarChart3 size={14} /> Reports
            </Link>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
          <span>{tasks.length} tasks</span>
          <span>{project.members?.length ?? 0} members</span>
          {tasks.length > 0 && <span className="text-green-600 font-medium">{progress}% complete</span>}
        </div>

        {tasks.length > 0 && (
          <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="font-semibold dark:text-white">Tasks</h2>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input text-sm py-1.5 w-auto"
            >
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm py-1.5">
              <Plus size={14} /> Add Task
            </button>
          </div>
        </div>

        <div className="card divide-y divide-gray-100 dark:divide-gray-800">
          {tasksLoading ? (
            <div className="py-8 text-center text-gray-400 text-sm">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{statusFilter ? 'No tasks with this status.' : 'No tasks yet.'}</p>
              {!statusFilter && (
                <button onClick={() => setShowCreate(true)} className="btn-primary mt-3 inline-flex text-sm">
                  <Plus size={14} /> Add your first task
                </button>
              )}
            </div>
          ) : (
            tasks.map((task) => (
              <TaskRow key={task.id} task={task} projectId={projectId!} />
            ))
          )}
        </div>
      </div>

      {showCreate && <CreateTaskModal projectId={projectId!} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
