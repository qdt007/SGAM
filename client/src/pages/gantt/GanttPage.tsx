import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@iconify/react';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { useProjectRealtime } from '../../hooks/useProjectRealtime';
import { Breadcrumbs } from '../../components/ui/Page';
import { PageLoader } from '../../components/ui/States';
import { usePlan } from '../../hooks/usePlan';
import { UpgradePrompt } from '../../components/billing/UpgradePrompt';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import {
  addDays,
  format,
  startOfDay,
  differenceInDays,
  eachDayOfInterval,
  isToday,
  isWeekend,
  startOfWeek,
  isSameWeek,
} from 'date-fns';
import { BackButton } from '../../components/ui/BackButton';

/* ─── Config ─────────────────────────────── */
const DAY_W = 36;
const ROW_H = 48;

const STATUS_BAR: Record<string, { bg: string; border: string; icon: string }> = {
  BACKLOG: { bg: 'from-gray-400 to-gray-500', border: 'border-line-strong', icon: 'ph:tray-duotone' },
  TODO: { bg: 'from-blue-400 to-blue-500', border: 'border-blue-500', icon: 'ph:circle-dashed-duotone' },
  IN_PROGRESS: {
    bg: 'from-yellow-400 to-amber-500',
    border: 'border-amber-500',
    icon: 'ph:arrow-circle-right-duotone',
  },
  IN_REVIEW: { bg: 'from-purple-400 to-purple-600', border: 'border-purple-500', icon: 'ph:magnifying-glass-duotone' },
  DONE: { bg: 'from-emerald-400 to-green-500', border: 'border-green-500', icon: 'ph:check-circle-duotone' },
  CANCELLED: { bg: 'from-red-300 to-red-400', border: 'border-red-400', icon: 'ph:x-circle-duotone' },
};

const PRIORITY_RING: Record<string, string> = {
  CRITICAL: 'ring-2 ring-red-500',
  HIGH: 'ring-2 ring-orange-400',
  MEDIUM: '',
  LOW: '',
};

const STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

/* ─── Helpers ────────────────────────────── */
function buildDateRange(tasks: Task[]) {
  const today = startOfDay(new Date());
  const datedTasks = tasks.filter((t) => t.dueDate);
  if (!datedTasks.length) {
    return { start: addDays(today, -7), end: addDays(today, 30) };
  }
  const dates = datedTasks.map((t) => startOfDay(new Date(t.dueDate!)).getTime());
  const earliest = new Date(Math.min(...dates));
  const latest = new Date(Math.max(...dates));
  return {
    start: addDays(startOfWeek(earliest), -4),
    end: addDays(latest, 10),
  };
}

/* ─── Tooltip ────────────────────────────── */
function TaskTooltip({ task }: { task: Task }) {
  const s = STATUS_BAR[task.status] ?? STATUS_BAR.TODO;
  return (
    <div
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none
 bg-ink text-white rounded-xl px-3 py-2 shadow-2xl border border-white/10
 whitespace-nowrap text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 min-w-max"
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon icon={s.icon} width={13} className="opacity-80" />
        <span className="font-semibold">{task.title}</span>
      </div>
      <div className="flex items-center gap-3 text-white/70">
        <span>{STATUS_LABEL[task.status]}</span>
        <span>·</span>
        <span>{task.priority}</span>
        {task.dueDate && (
          <>
            <span>·</span>
            <span>Due {format(new Date(task.dueDate), 'MMM d')}</span>
          </>
        )}
      </div>
      {/* Arrow */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-800" />
    </div>
  );
}

/* ─── Main page ──────────────────────────── */
export function GanttPage() {
  const { projectId } = useParams<{ projectId: string }>();
  useProjectRealtime(projectId);
  const { canUseGantt, isLoading: planLoading } = usePlan();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

  const { data: dependencies = [] } = useQuery({
    queryKey: ['tasks', 'dependencies', projectId],
    queryFn: () => tasksApi.listProjectDependencies(projectId!),
    enabled: !!projectId && canUseGantt,
  });

  const { start, end } = useMemo(() => buildDateRange(tasks), [tasks]);
  const days = useMemo(() => eachDayOfInterval({ start, end }), [start, end]);
  const today = startOfDay(new Date());
  const todayOffset = differenceInDays(today, start) * DAY_W;

  // Group days into weeks for the header
  const weeks = useMemo(() => {
    const result: { label: string; count: number }[] = [];
    let cur = startOfWeek(days[0]);
    let count = 0;
    for (const d of days) {
      if (isSameWeek(d, cur)) {
        count++;
      } else {
        result.push({ label: format(cur, 'MMM d'), count });
        cur = startOfWeek(d);
        count = 1;
      }
    }
    if (count > 0) result.push({ label: format(cur, 'MMM d'), count });
    return result;
  }, [days]);

  const tasksWithPos = useMemo(
    () =>
      tasks.map((task) => {
        const due = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
        const start2 = task.startDate ? startOfDay(new Date(task.startDate)) : due ? addDays(due, -3) : today;
        const end2 = due ?? addDays(today, 1);
        const left = Math.max(0, differenceInDays(start2, start)) * DAY_W;
        const width = Math.max(DAY_W, (differenceInDays(end2, start2) + 1) * DAY_W);
        return { ...task, left, width, hasDates: !!task.dueDate };
      }),
    [tasks, start],
  );

  const datedTasks = tasksWithPos.filter((t) => t.hasDates);
  const undatedTasks = tasksWithPos.filter((t) => !t.hasDates);

  /* Dependency arrows: blocking bar's right edge -> blocked bar's left edge.
 Only pairs where both bars are on the chart can be drawn. */
  const arrows = useMemo(() => {
    const rowOf = new Map(datedTasks.map((t, i) => [t.id, i]));
    return dependencies.flatMap((dep) => {
      const fromRow = rowOf.get(dep.blockingTaskId);
      const toRow = rowOf.get(dep.blockedTaskId);
      if (fromRow === undefined || toRow === undefined) return [];
      const from = datedTasks[fromRow];
      const to = datedTasks[toRow];
      const x1 = from.left + from.width;
      const y1 = fromRow * ROW_H + ROW_H / 2;
      const x2 = to.left;
      const y2 = toRow * ROW_H + ROW_H / 2;
      const gap = Math.max(12, Math.min(20, Math.abs(x2 - x1) / 2));
      // Elbow: out of the source, across at the midpoint, into the target's left edge.
      const midX = x2 - gap > x1 + gap ? (x1 + x2) / 2 : x1 + gap;
      const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
      return [{ id: dep.id, d, blockingTaskId: dep.blockingTaskId, blockedTaskId: dep.blockedTaskId }];
    });
  }, [dependencies, datedTasks]);

  if (isLoading || planLoading) return <PageLoader label="Loading timeline" />;

  if (!canUseGantt) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-x-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <BackButton to={`/projects/${projectId}`} />
          <div className="min-w-0">
            <Breadcrumbs
              items={[
                { label: 'Projects', to: '/projects' },
                { label: project?.name ?? 'Project', to: `/projects/${projectId}` },
              ]}
            />
            <h1 className="mt-0.5 font-display text-subhead font-bold text-ink">Timeline</h1>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <UpgradePrompt
            title="Gantt timeline thuộc gói Pro"
            description="Nhìn toàn bộ tiến độ trên một dòng thời gian, kèm mũi tên phụ thuộc giữa các công việc."
            features={['Timeline theo ngày với đường hôm nay', 'Phụ thuộc giữa các task, có chặn vòng lặp', 'Báo cáo burndown và workload']}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-sunken bg-page overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <BackButton to={`/projects/${projectId}`} />
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: 'Projects', to: '/projects' },
              { label: project?.name ?? 'Project', to: `/projects/${projectId}` },
            ]}
          />
          <h1 className="mt-0.5 font-display text-subhead font-bold text-ink">Timeline</h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
          {Object.entries(STATUS_BAR)
            .slice(0, 5)
            .map(([s, v]) => (
              <span key={s} className="hidden items-center gap-1.5 md:flex">
                <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${v.bg}`} aria-hidden />
                {STATUS_LABEL[s]}
              </span>
            ))}
        </div>
      </header>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <Icon icon="ph:chart-bar-duotone" width={48} className="text-ink-subtle/70" />
          <p className="text-ink-muted text-sm">No tasks yet. Add tasks with due dates to see the Gantt chart.</p>
          <Link to={`/projects/${projectId}`} className="btn-primary text-sm mt-1">
            Add Tasks
          </Link>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="flex" style={{ minWidth: days.length * DAY_W + 240 }}>
            {/* ── Left sidebar ── */}
            <div className="w-60 shrink-0 sticky left-0 z-30 bg-surface border-r border-line">
              {/* Week header placeholder */}
              <div className="h-8 border-b border-line bg-sunken/60 px-3 flex items-center">
                <span className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Task</span>
              </div>
              {/* Day header placeholder */}
              <div className="h-10 border-b border-line" />

              {/* Task rows */}
              {datedTasks.map((task) => {
                const s = STATUS_BAR[task.status] ?? STATUS_BAR.TODO;
                return (
                  <div
                    key={task.id}
                    onMouseEnter={() => setHoveredId(task.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={cn(
                      'h-12 flex items-center gap-2.5 px-3 border-b border-line-soft cursor-default transition-colors',
                      hoveredId === task.id ? 'bg-primary/10' : 'hover:bg-ink/[0.04]',
                    )}
                  >
                    <Icon
                      icon={s.icon}
                      width={15}
                      className={`shrink-0 text-transparent bg-gradient-to-br ${s.bg} bg-clip-text`}
                      style={{ filter: 'saturate(1.2)' }}
                    />
                    <span className="text-xs text-ink-muted truncate font-medium">{task.title}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Timeline ── */}
            <div className="flex-1 relative">
              {/* Week header */}
              <div className="h-8 sticky top-0 z-20 bg-sunken/90 border-b border-line flex backdrop-blur-sm">
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    style={{ width: w.count * DAY_W, minWidth: w.count * DAY_W }}
                    className="flex items-center px-2 border-r border-line"
                  >
                    <span className="text-xs font-semibold text-ink-muted truncate">{w.label}</span>
                  </div>
                ))}
              </div>

              {/* Day header */}
              <div className="h-10 sticky top-8 z-20 bg-surface border-b border-line flex">
                {days.map((day, i) => (
                  <div
                    key={i}
                    style={{ width: DAY_W, minWidth: DAY_W }}
                    className={cn(
                      'flex flex-col items-center justify-center border-r border-line-soft/60 select-none',
                      isWeekend(day) && 'bg-sunken/80',
                      isToday(day) && 'bg-primary/10',
                    )}
                  >
                    <span className="text-ink-subtle" style={{ fontSize: 9 }}>
                      {format(day, 'EEE')}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        isToday(day)
                          ? 'text-white bg-primary rounded-full h-5 w-5 flex items-center justify-center'
                          : isWeekend(day)
                            ? 'text-ink-subtle'
                            : 'text-ink-muted',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Grid + bars */}
              <div className="relative">
                {/* Today line */}
                {todayOffset >= 0 && (
                  <div
                    className="absolute top-0 bottom-0 z-10 pointer-events-none"
                    style={{ left: todayOffset + DAY_W / 2 }}
                  >
                    <div className="w-0.5 h-full bg-primary opacity-60" />
                    <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-primary text-white rounded-full px-1.5 py-0.5 text-xs font-bold whitespace-nowrap shadow">
                      Today
                    </div>
                  </div>
                )}

                {/* Dependency arrows */}
                {arrows.length > 0 && (
                  <svg
                    className="absolute top-0 left-0 z-10 pointer-events-none overflow-visible"
                    width={days.length * DAY_W}
                    height={datedTasks.length * ROW_H}
                    aria-hidden
                  >
                    <defs>
                      <marker
                        id="gantt-arrow"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 z" className="fill-gray-400 dark:fill-gray-500" />
                      </marker>
                      <marker
                        id="gantt-arrow-active"
                        viewBox="0 0 8 8"
                        refX="7"
                        refY="4"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto"
                      >
                        <path d="M0,0 L8,4 L0,8 z" className="fill-primary-600" />
                      </marker>
                    </defs>
                    {arrows.map((a) => {
                      const active = hoveredId === a.blockingTaskId || hoveredId === a.blockedTaskId;
                      return (
                        <path
                          key={a.id}
                          d={a.d}
                          fill="none"
                          strokeWidth={active ? 2 : 1.5}
                          strokeLinejoin="round"
                          className={active ? 'stroke-primary-600' : 'stroke-gray-400 dark:stroke-gray-600'}
                          markerEnd={active ? 'url(#gantt-arrow-active)' : 'url(#gantt-arrow)'}
                          opacity={active ? 1 : 0.7}
                        />
                      );
                    })}
                  </svg>
                )}

                {/* Row backgrounds + bars */}
                {datedTasks.map((task) => {
                  const s = STATUS_BAR[task.status] ?? STATUS_BAR.TODO;
                  const isHovered = hoveredId === task.id;
                  return (
                    <div
                      key={task.id}
                      onMouseEnter={() => setHoveredId(task.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={cn(
                        'relative h-12 border-b border-line-soft flex items-center',
                        isHovered ? 'bg-primary-50/60 dark:bg-primary-900/10' : 'bg-surface/40',
                      )}
                    >
                      {/* Weekend columns */}
                      {days.map(
                        (day, i) =>
                          isWeekend(day) && (
                            <div
                              key={i}
                              className="absolute top-0 bottom-0 bg-sunken/20"
                              style={{ left: i * DAY_W, width: DAY_W }}
                            />
                          ),
                      )}

                      {/* Task bar */}
                      <div
                        className={cn(
                          'absolute h-7 rounded-lg bg-gradient-to-r shadow-sm flex items-center px-2 gap-1.5',
                          'transition-all duration-300 cursor-pointer group',
                          s.bg,
                          PRIORITY_RING[task.priority],
                          isHovered ? 'h-8 shadow-lg brightness-110' : '',
                        )}
                        style={{
                          left: task.left + 2,
                          width: task.width - 4,
                          transitionProperty: 'height, box-shadow, filter',
                        }}
                      >
                        <Icon icon={s.icon} width={12} className="text-white/80 shrink-0" />
                        {task.width > 72 && (
                          <span className="text-white text-xs font-semibold truncate leading-none drop-shadow">
                            {task.title}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="ml-auto text-white/70 text-xs shrink-0 hidden sm:block">
                            {format(new Date(task.dueDate), 'MMM d')}
                          </span>
                        )}

                        {/* Tooltip */}
                        <TaskTooltip task={task} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Undated tasks */}
          {undatedTasks.length > 0 && (
            <div className="border-t border-line bg-surface px-6 py-4">
              <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Icon icon="ph:calendar-slash-duotone" width={14} />
                Tasks without due dates
              </p>
              <div className="flex flex-wrap gap-2">
                {undatedTasks.map((task) => {
                  const s = STATUS_BAR[task.status] ?? STATUS_BAR.TODO;
                  return (
                    <span
                      key={task.id}
                      className="flex items-center gap-1.5 text-xs bg-sunken text-ink-muted rounded-lg px-2.5 py-1.5 border border-line"
                    >
                      <Icon icon={s.icon} width={12} className="text-ink-subtle" />
                      {task.title}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
