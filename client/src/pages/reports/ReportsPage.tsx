import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, BarChart3, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { format, isPast } from 'date-fns';

const STATUS_ORDER = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review', DONE: 'Done', CANCELLED: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  BACKLOG: 'bg-gray-400', TODO: 'bg-blue-400', IN_PROGRESS: 'bg-yellow-400',
  IN_REVIEW: 'bg-purple-400', DONE: 'bg-green-500', CANCELLED: 'bg-red-300',
};

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-500', HIGH: 'bg-orange-400', MEDIUM: 'bg-yellow-400', LOW: 'bg-green-400',
};

function ProgressBar({ label, count, total, colorClass }: { label: string; count: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-800 dark:text-gray-200">{count} <span className="text-gray-400">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();

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

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const overdue = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && t.status !== 'DONE' && t.status !== 'CANCELLED'
  );

  const byStatus = STATUS_ORDER.map((s) => ({
    status: s,
    count: tasks.filter((t) => t.status === s).length,
  }));

  const byPriority = PRIORITY_ORDER.map((p) => ({
    priority: p,
    count: tasks.filter((t) => t.priority === p).length,
  }));

  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
        <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1">
          <ChevronLeft size={14} /> {project?.name ?? 'Project'}
        </Link>
        <span className="text-gray-300">/</span>
        <BarChart3 size={14} className="text-gray-400" />
        <span className="text-sm font-semibold dark:text-white">Reports</span>
      </div>

      <div className="p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Tasks', value: total, icon: BarChart3, color: 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' },
            { label: 'Completed', value: done, icon: CheckCircle2, color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
            { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
            { label: 'Overdue', value: overdue.length, icon: AlertCircle, color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex items-center gap-3">
              <div className={cn('rounded-lg p-2', color)}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-xl font-bold dark:text-white">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Overall progress */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold dark:text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-500" /> Overall Progress
            </h2>
            <span className="text-2xl font-bold text-primary-600">{progress}%</span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-500">{done} of {total} tasks completed</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* By status */}
          <div className="card space-y-4">
            <h2 className="font-semibold dark:text-white">Tasks by Status</h2>
            <div className="space-y-3">
              {byStatus.map(({ status, count }) => (
                <ProgressBar
                  key={status}
                  label={STATUS_LABEL[status]}
                  count={count}
                  total={total}
                  colorClass={STATUS_COLOR[status]}
                />
              ))}
            </div>
          </div>

          {/* By priority */}
          <div className="card space-y-4">
            <h2 className="font-semibold dark:text-white">Tasks by Priority</h2>
            <div className="space-y-3">
              {byPriority.map(({ priority, count }) => (
                <ProgressBar
                  key={priority}
                  label={priority.charAt(0) + priority.slice(1).toLowerCase()}
                  count={count}
                  total={total}
                  colorClass={PRIORITY_COLOR[priority]}
                />
              ))}
            </div>

            {/* Mini donut */}
            <div className="mt-4 flex flex-wrap gap-2">
              {byPriority.filter((p) => p.count > 0).map(({ priority, count }) => (
                <div key={priority} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                  <span className={cn('h-2.5 w-2.5 rounded-full', PRIORITY_COLOR[priority])} />
                  {priority.charAt(0) + priority.slice(1).toLowerCase()}: {count}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue tasks */}
        {overdue.length > 0 && (
          <div className="card border-red-200 dark:border-red-900/50">
            <h2 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertCircle size={16} /> Overdue Tasks ({overdue.length})
            </h2>
            <div className="space-y-2">
              {overdue.map((task) => (
                <div key={task.id} className="flex items-center gap-3 py-2 px-3 bg-red-50 dark:bg-red-900/10 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{task.title}</p>
                    <p className="text-xs text-red-500">Due {format(new Date(task.dueDate!), 'MMM d, yyyy')}</p>
                  </div>
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded font-medium">
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div className="card">
          <h2 className="font-semibold dark:text-white mb-3">Recently Updated</h2>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No tasks yet.</p>
            ) : recentTasks.map((task) => (
              <div key={task.id} className="py-2.5 flex items-center gap-3">
                <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_COLOR[task.status])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 dark:text-white truncate">{task.title}</p>
                  <p className="text-xs text-gray-500">{STATUS_LABEL[task.status]} · {task.priority}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {format(new Date(task.updatedAt), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
