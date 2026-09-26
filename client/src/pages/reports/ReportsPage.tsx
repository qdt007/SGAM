import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, BarChart3, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { reportsApi } from '../../api/reportsApi';
import { useProjectRealtime } from '../../hooks/useProjectRealtime';
import { BurndownChart } from '../../components/reports/BurndownChart';
import { WorkloadTable } from '../../components/reports/WorkloadTable';
import { keys } from '../../constants/queryKeys';
import { Page, PageHeader, StatTile } from '../../components/ui/Page';
import { PageLoader } from '../../components/ui/States';
import { usePlan } from '../../hooks/usePlan';
import { UpgradePrompt } from '../../components/billing/UpgradePrompt';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { format, isPast } from 'date-fns';

const STATUS_ORDER = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'];
const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  BACKLOG: 'bg-ink-subtle',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  IN_REVIEW: 'bg-purple-400',
  DONE: 'bg-green-500',
  CANCELLED: 'bg-red-300',
};

const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-green-400',
};

function ProgressBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-medium text-ink">
          {count} <span className="text-ink-subtle">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-sunken rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', colorClass)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useProjectRealtime(projectId);
  const { canUseReports, isLoading: planLoading } = usePlan();

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

  // Server-side reports: the numbers below come from the whole project, not just the loaded page of tasks.
  const { data: summary } = useQuery({
    queryKey: keys.reports.summary(projectId!),
    queryFn: () => reportsApi.summary(projectId!),
    enabled: !!projectId && canUseReports,
  });

  const { data: burndown } = useQuery({
    queryKey: keys.reports.burndown(projectId!),
    queryFn: () => reportsApi.burndown(projectId!),
    enabled: !!projectId && canUseReports,
  });

  const { data: workload } = useQuery({
    queryKey: keys.reports.workload(projectId!),
    queryFn: () => reportsApi.workload(projectId!),
    enabled: !!projectId && canUseReports,
  });

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const overdue = tasks.filter(
    (t) => t.dueDate && isPast(new Date(t.dueDate)) && t.status !== 'DONE' && t.status !== 'CANCELLED',
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

  if (isLoading || planLoading) return <PageLoader label="Loading reports" />;

  if (!canUseReports) {
    return (
      <Page>
        <PageHeader
          breadcrumbs={[
            { label: 'Projects', to: '/projects' },
            { label: project?.name ?? 'Project', to: `/projects/${projectId}` },
          ]}
          backTo={`/projects/${projectId}`}
          title="Reports"
        />
        <div className="card-flush">
          <UpgradePrompt
            title="Báo cáo thuộc gói Pro"
            description="Xem tiến độ burndown và khối lượng công việc của từng thành viên để đánh giá đóng góp công bằng hơn."
            features={['Burndown theo ngày so với đường lý tưởng', 'Workload từng thành viên kèm giờ đã log', 'Project và thành viên không giới hạn']}
          />
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: 'Projects', to: '/projects' },
          { label: project?.name ?? 'Project', to: `/projects/${projectId}` },
        ]}
        backTo={`/projects/${projectId}`}
        title="Reports"
        description="Progress, burndown and per-member workload for this project."
      />

      <div className="stack">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Total tasks" value={summary?.total ?? total} icon="ph:check-square-duotone" />
          <StatTile
            label="Completed"
            value={summary?.done ?? done}
            hint={`${summary?.progress ?? progress}% of scope`}
            icon="ph:check-circle-duotone"
            tone="success"
          />
          <StatTile
            label="Hours logged"
            value={summary?.loggedHrs ?? 0}
            hint={`${summary?.estimatedHrs ?? 0}h estimated`}
            icon="ph:timer-duotone"
          />
          <StatTile
            label="Overdue"
            value={summary?.overdue ?? overdue.length}
            hint={(summary?.overdue ?? overdue.length) ? 'needs attention' : 'nothing late'}
            icon="ph:warning-circle-duotone"
            tone={(summary?.overdue ?? overdue.length) ? 'danger' : 'neutral'}
          />
        </div>

        {/* Overall progress */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" /> Overall Progress
            </h2>
            <span className="text-2xl font-bold text-primary">{progress}%</span>
          </div>
          <div className="h-3 bg-sunken rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-ink-muted">
            {done} of {total} tasks completed
          </p>
        </div>

        {burndown && burndown.points.length > 1 && (
          <div className="card">
            <BurndownChart report={burndown} />
          </div>
        )}

        {workload && (
          <div className="card">
            <WorkloadTable report={workload} />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {/* By status */}
          <div className="card space-y-4">
            <h2 className="section-title">Tasks by Status</h2>
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
            <h2 className="section-title">Tasks by Priority</h2>
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
              {byPriority
                .filter((p) => p.count > 0)
                .map(({ priority, count }) => (
                  <div key={priority} className="flex items-center gap-1.5 text-xs text-ink-muted">
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
            <h2 className="section-title text-red-600 dark:text-red-400 flex items-center gap-2 mb-3">
              <AlertCircle size={16} /> Overdue Tasks ({overdue.length})
            </h2>
            <div className="space-y-2">
              {overdue.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 py-2 px-3 bg-red-50 dark:bg-red-900/10 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{task.title}</p>
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
          <h2 className="section-title mb-3">Recently Updated</h2>
          <div className="divide-y divide-line-soft">
            {recentTasks.length === 0 ? (
              <p className="text-sm text-ink-muted py-4 text-center">No tasks yet.</p>
            ) : (
              recentTasks.map((task) => (
                <div key={task.id} className="py-2.5 flex items-center gap-3">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_COLOR[task.status])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{task.title}</p>
                    <p className="text-xs text-ink-muted">
                      {STATUS_LABEL[task.status]} · {task.priority}
                    </p>
                  </div>
                  <span className="text-xs text-ink-subtle shrink-0">{format(new Date(task.updatedAt), 'MMM d')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Page>
  );
}
