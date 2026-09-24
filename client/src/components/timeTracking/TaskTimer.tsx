import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeApi } from '../../api/timeApi';
import { useTimeTracker } from '../../hooks/useTimeTracker';
import { useAuthStore } from '../../stores/authStore';
import { durationFromMinutes, formatRelative } from '../../utils/dateUtils';
import { keys } from '../../constants/queryKeys';
import { cn } from '../../utils/cn';

/** Start/stop control plus this task's time log history. */
export function TaskTimer({
  taskId,
  taskTitle,
  canTrack = true,
}: {
  taskId: string;
  taskTitle: string;
  canTrack?: boolean;
}) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { isActive, formattedElapsed, isStarting, isStopping, start, stop } = useTimeTracker(taskId);

  const { data: logs = [] } = useQuery({
    queryKey: keys.tasks.timeLogs(taskId),
    queryFn: () => timeApi.listByTask(taskId),
  });

  const { mutate: removeLog } = useMutation({
    mutationFn: (id: string) => timeApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.tasks.timeLogs(taskId) }),
  });

  const totalMin = logs.reduce((s, l) => s + (l.durationMin ?? 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="ph:timer-duotone" width={18} className="text-ink-muted" />
        <h3 className="text-sm font-semibold text-ink">Time tracking</h3>
        {totalMin > 0 && <span className="text-xs text-ink-muted">· {durationFromMinutes(totalMin)} logged</span>}
      </div>

      {canTrack && (
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl px-4 py-3',
            isActive ? 'bg-emerald-500/10' : 'bg-black/[0.03]',
          )}
        >
          <button
            onClick={() => (isActive ? stop() : start())}
            disabled={isStarting || isStopping}
            className={cn(
              'btn text-sm px-4 py-1.5 text-white',
              isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700',
            )}
            title={isActive ? `Stop timer for ${taskTitle}` : `Start timer for ${taskTitle}`}
          >
            <Icon icon={isActive ? 'ph:stop-fill' : 'ph:play-fill'} width={14} />
            {isActive ? 'Stop' : 'Start'}
          </button>
          <span
            className={cn(
              'font-mono text-lg tabular-nums',
              isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-muted',
            )}
          >
            {isActive ? formattedElapsed : '00:00:00'}
          </span>
          {isActive && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-auto" />}
        </div>
      )}

      {logs.length > 0 && (
        <div className="space-y-1">
          {logs.map((l) => (
            <div key={l.id} className="group flex items-center gap-2 text-xs px-1 py-1">
              <Icon icon="ph:clock-duotone" width={14} className="text-ink-muted shrink-0" />
              <span className="text-ink">{l.durationMin ? durationFromMinutes(l.durationMin) : 'running…'}</span>
              <span className="text-ink-muted truncate">
                {l.user?.displayName} · {formatRelative(l.startedAt)}
              </span>
              {l.note && <span className="text-ink-muted truncate italic">— {l.note}</span>}
              {l.userId === user?.id && l.endedAt && (
                <button
                  onClick={() => removeLog(l.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted hover:text-red-500"
                  aria-label="Delete time log"
                >
                  <Icon icon="ph:trash" width={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
