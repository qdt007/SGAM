import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Calendar } from 'lucide-react';
import { projectsApi } from '../../api/projectsApi';
import { tasksApi } from '../../api/tasksApi';
import { Task } from '../../types';
import { cn } from '../../utils/cn';
import { addDays, format, startOfDay, differenceInDays, eachDayOfInterval, startOfWeek, isSameDay, isToday } from 'date-fns';

const STATUS_BAR: Record<string, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  IN_REVIEW: 'bg-purple-400',
  DONE: 'bg-green-500',
  CANCELLED: 'bg-red-300',
};

const PRIORITY_STRIPE: Record<string, string> = {
  CRITICAL: 'border-l-4 border-red-500',
  HIGH: 'border-l-4 border-orange-400',
  MEDIUM: 'border-l-4 border-yellow-400',
  LOW: 'border-l-4 border-green-400',
};

const DAY_WIDTH = 28;

export function GanttPage() {
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

  const { startDate, endDate, days, weeks } = useMemo(() => {
    const tasksWithDates = tasks.filter((t) => t.dueDate);
    const today = startOfDay(new Date());

    if (tasksWithDates.length === 0) {
      const s = addDays(today, -7);
      const e = addDays(today, 30);
      const d = eachDayOfInterval({ start: s, end: e });
      const w = buildWeeks(d);
      return { startDate: s, endDate: e, days: d, weeks: w };
    }

    const dates = tasksWithDates.map((t) => new Date(t.dueDate!));
    const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
    const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
    const s = addDays(startOfWeek(earliest), -3);
    const e = addDays(latest, 7);
    const d = eachDayOfInterval({ start: s, end: e });
    const w = buildWeeks(d);
    return { startDate: s, endDate: e, days: d, weeks: w };
  }, [tasks]);

  const tasksWithPos = useMemo(() => {
    const today = startOfDay(new Date());
    return tasks.map((task) => {
      const due = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
      const start = task.startDate ? startOfDay(new Date(task.startDate)) : due ? addDays(due, -3) : today;
      const end = due ?? addDays(today, 1);

      const left = Math.max(0, differenceInDays(start, startDate)) * DAY_WIDTH;
      const width = Math.max(DAY_WIDTH, (differenceInDays(end, start) + 1) * DAY_WIDTH);

      return { ...task, left, width, hasDates: !!task.dueDate };
    });
  }, [tasks, startDate]);

  const todayOffset = differenceInDays(startOfDay(new Date()), startDate) * DAY_WIDTH;

  if (isLoading) return (
    <div className="flex h-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3 shrink-0">
        <Link to={`/projects/${projectId}`} className="text-sm text-gray-500 hover:text-primary-600 flex items-center gap-1">
          <ChevronLeft size={14} /> {project?.name ?? 'Project'}
        </Link>
        <span className="text-gray-300">/</span>
        <Calendar size={14} className="text-gray-400" />
        <span className="text-sm font-semibold dark:text-white">Gantt Chart</span>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          {Object.entries(STATUS_BAR).slice(0, 4).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('h-2.5 w-2.5 rounded-sm', c)} />
              {s.replace('_', ' ')}
            </span>
          ))}
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
          <Calendar size={40} className="text-gray-300" />
          <p className="text-gray-500 text-sm">No tasks yet. Add tasks with due dates to see the Gantt chart.</p>
          <Link to={`/projects/${projectId}`} className="btn-primary text-sm mt-2">Add Tasks</Link>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="flex" style={{ minWidth: days.length * DAY_WIDTH + 220 }}>
            {/* Left sidebar */}
            <div className="w-[220px] shrink-0 border-r border-gray-200 dark:border-gray-800 sticky left-0 z-20 bg-white dark:bg-gray-900">
              {/* Header placeholder */}
              <div className="h-10 border-b border-gray-200 dark:border-gray-800" />
              {/* Week row placeholder */}
              <div className="h-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60" />
              {tasksWithPos.map((task) => (
                <div
                  key={task.id}
                  className="h-10 flex items-center px-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300 truncate hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  title={task.title}
                >
                  <span className={cn('w-1 h-4 rounded-sm mr-2 shrink-0', STATUS_BAR[task.status])} />
                  <span className="truncate">{task.title}</span>
                </div>
              ))}
            </div>

            {/* Timeline grid */}
            <div className="flex-1 relative">
              {/* Month/date header */}
              <div className="h-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex sticky top-0 z-10">
                {days.map((day, i) => (
                  <div
                    key={i}
                    style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                    className={cn(
                      'border-r border-gray-100 dark:border-gray-800 flex flex-col items-center justify-center text-center',
                      isToday(day) && 'bg-primary-50 dark:bg-primary-900/20'
                    )}
                  >
                    {day.getDate() === 1 && (
                      <span className="text-xs font-semibold text-primary-600 absolute -top-0 leading-none" style={{ fontSize: 10 }}>
                        {format(day, 'MMM')}
                      </span>
                    )}
                    <span className={cn('text-xs', isToday(day) ? 'font-bold text-primary-600' : 'text-gray-400', day.getDay() === 0 || day.getDay() === 6 ? 'text-gray-300 dark:text-gray-600' : '')}>
                      {format(day, 'd')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Week labels row */}
              <div className="h-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60 flex sticky top-10 z-10">
                {weeks.map((w, i) => (
                  <div
                    key={i}
                    style={{ width: w.days * DAY_WIDTH, minWidth: w.days * DAY_WIDTH }}
                    className="border-r border-gray-200 dark:border-gray-700 flex items-center px-2"
                  >
                    <span className="text-xs text-gray-500 font-medium truncate">{w.label}</span>
                  </div>
                ))}
              </div>

              {/* Task bars */}
              <div className="relative">
                {/* Today line */}
                {todayOffset >= 0 && todayOffset <= days.length * DAY_WIDTH && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary-500 z-10 pointer-events-none"
                    style={{ left: todayOffset + DAY_WIDTH / 2 }}
                  />
                )}

                {tasksWithPos.map((task) => (
                  <div key={task.id} className="h-10 flex items-center border-b border-gray-100 dark:border-gray-800 relative">
                    {/* Weekend shading */}
                    {days.map((day, i) => (
                      (day.getDay() === 0 || day.getDay() === 6) && (
                        <div
                          key={i}
                          className="absolute top-0 bottom-0 bg-gray-50 dark:bg-gray-800/30"
                          style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                        />
                      )
                    ))}

                    {task.hasDates && (
                      <div
                        className={cn(
                          'absolute h-6 rounded flex items-center px-2 text-white text-xs font-medium shadow-sm truncate cursor-pointer hover:opacity-90 transition-opacity',
                          STATUS_BAR[task.status],
                          PRIORITY_STRIPE[task.priority],
                          task.status === 'DONE' && 'opacity-70'
                        )}
                        style={{ left: task.left, width: task.width }}
                        title={`${task.title} · ${task.status} · ${task.priority}`}
                      >
                        <span className="truncate">{task.title}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks without dates */}
          {tasksWithPos.some((t) => !t.hasDates) && (
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs text-gray-500 mb-2 font-medium">Tasks without due dates</p>
              <div className="flex flex-wrap gap-2">
                {tasksWithPos.filter((t) => !t.hasDates).map((task) => (
                  <span key={task.id} className="text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 text-gray-600 dark:text-gray-300">
                    {task.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function buildWeeks(days: Date[]) {
  const weeks: { label: string; days: number }[] = [];
  let currentWeekStart = startOfWeek(days[0]);
  let count = 0;
  for (const day of days) {
    const ws = startOfWeek(day);
    if (isSameDay(ws, currentWeekStart)) {
      count++;
    } else {
      weeks.push({ label: `Week of ${format(currentWeekStart, 'MMM d')}`, days: count });
      currentWeekStart = ws;
      count = 1;
    }
  }
  if (count > 0) weeks.push({ label: `Week of ${format(currentWeekStart, 'MMM d')}`, days: count });
  return weeks;
}
