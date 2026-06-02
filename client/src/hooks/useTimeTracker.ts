import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { timeApi } from '../api/timeApi';
import { useTimerStore, getElapsedSeconds } from '../stores/timerStore';
import { keys } from '../constants/queryKeys';

export function useTimeTracker(taskId: string) {
  const queryClient = useQueryClient();
  const { activeTimer, startTimer, stopTimer, clearTimer } = useTimerStore();
  const [elapsed, setElapsed] = useState(0);
  const isActive = activeTimer?.taskId === taskId;

  useEffect(() => {
    if (!isActive || !activeTimer?.startTime) return;
    setElapsed(getElapsedSeconds(activeTimer.startTime));
    const interval = setInterval(
      () => setElapsed(getElapsedSeconds(activeTimer.startTime)),
      1000
    );
    return () => clearInterval(interval);
  }, [isActive, activeTimer?.startTime]);

  const { mutate: start, isPending: isStarting } = useMutation({
    mutationFn: () => timeApi.startTimer(taskId),
    onSuccess: (log) => startTimer(taskId, '', log.id),
  });

  const { mutate: stop, isPending: isStopping } = useMutation({
    mutationFn: async () => {
      const t = useTimerStore.getState().activeTimer;
      if (!t?.timeLogId) throw new Error('No active timer');
      return timeApi.stopTimer(taskId, t.timeLogId);
    },
    onSuccess: () => {
      stopTimer();
      queryClient.invalidateQueries({ queryKey: keys.tasks.timeLogs(taskId) });
    },
    onError: () => clearTimer(),
  });

  const formatElapsed = (s: number): string =>
    [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
      .map((v) => String(v).padStart(2, '0'))
      .join(':');

  return { isActive, elapsed, formattedElapsed: formatElapsed(elapsed), isStarting, isStopping, start, stop };
}
