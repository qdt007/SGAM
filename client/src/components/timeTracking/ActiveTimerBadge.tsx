import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { timeApi } from '../../api/timeApi';
import { useTimerStore, getElapsedSeconds } from '../../stores/timerStore';
import { keys } from '../../constants/queryKeys';

const fmt = (s: number) =>
  [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');

/**
 * Global running-timer pill in the top bar. The server is the source of truth,
 * so a reload or a second tab still shows the timer that is actually running.
 */
export function ActiveTimerBadge() {
  const queryClient = useQueryClient();
  const { activeTimer, startTimer, clearTimer } = useTimerStore();
  const [elapsed, setElapsed] = useState(0);

  const { data: running } = useQuery({
    queryKey: ['time', 'running'],
    queryFn: () => timeApi.getRunning(),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // Reconcile the persisted local timer with whatever the server says is open.
  useEffect(() => {
    if (running) {
      if (activeTimer?.timeLogId !== running.id) {
        startTimer(running.taskId, running.task?.title ?? '', running.id);
      }
    } else if (activeTimer) {
      clearTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running?.id]);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(getElapsedSeconds(running.startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  const projectId = running.task?.projectId;
  const stop = async () => {
    await timeApi.stopTimer(running.taskId, running.id);
    clearTimer();
    queryClient.invalidateQueries({ queryKey: ['time', 'running'] });
    queryClient.invalidateQueries({ queryKey: keys.tasks.timeLogs(running.taskId) });
  };

  return (
    <div className="flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1.5">
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <span className="font-mono text-sm tabular-nums text-emerald-700 dark:text-emerald-400">{fmt(elapsed)}</span>
      {projectId ? (
        <Link to={`/projects/${projectId}`} className="text-xs text-ink max-w-[140px] truncate hover:underline">
          {running.task?.title}
        </Link>
      ) : (
        <span className="text-xs text-ink max-w-[140px] truncate">{running.task?.title}</span>
      )}
      <button onClick={stop} className="text-ink-muted hover:text-red-500 shrink-0" aria-label="Stop timer">
        <Icon icon="ph:stop-circle-duotone" width={18} />
      </button>
    </div>
  );
}
