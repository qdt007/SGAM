import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeApi } from '../../api/timeApi';
import { useTimeTracker } from '../../hooks/useTimeTracker';
import { useAuthStore } from '../../stores/authStore';
import { durationFromMinutes, formatRelative } from '../../utils/dateUtils';
import { keys } from '../../constants/queryKeys';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../ui/Modal';

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

  const [showManual, setShowManual] = useState(false);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualHours, setManualHours] = useState('1');
  const [manualNote, setManualNote] = useState('');
  const [manualError, setManualError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const { mutate: logManual, isPending: loggingManual } = useMutation({
    mutationFn: () => {
      // The API wants a real interval, so anchor the entry at 09:00 on the chosen day and let
      // the duration decide when it ended. Minute-level accuracy is not what manual entry is for.
      const started = new Date(`${manualDate}T09:00:00`);
      const ended = new Date(started.getTime() + Number(manualHours) * 60 * 60 * 1000);
      return timeApi.logManual(taskId, {
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
        note: manualNote.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.tasks.timeLogs(taskId) });
      setShowManual(false);
      setManualHours('1');
      setManualNote('');
      setManualError('');
    },
    onError: (e) =>
      setManualError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Could not save that time log',
      ),
  });

  const submitManual = () => {
    const hours = Number(manualHours);
    if (!manualDate) return setManualError('Pick a date.');
    if (!Number.isFinite(hours) || hours <= 0) return setManualError('Hours must be greater than 0.');
    if (hours > 24) return setManualError('One entry cannot be longer than 24 hours.');
    logManual();
  };

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

      {canTrack && (
        <div>
          {!showManual ? (
            <button
              onClick={() => setShowManual(true)}
              className="text-xs text-primary hover:underline"
            >
              + Log time manually
            </button>
          ) : (
            <div className="space-y-2 rounded-xl bg-black/[0.03] p-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-2xs text-ink-muted">Date</span>
                  <input
                    type="date"
                    value={manualDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="input py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-2xs text-ink-muted">Hours</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    value={manualHours}
                    onChange={(e) => setManualHours(e.target.value)}
                    className="input w-24 py-1 text-sm"
                  />
                </label>
              </div>
              <input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="What did you work on? (optional)"
                maxLength={500}
                className="input w-full py-1 text-sm"
              />
              {manualError && <p className="text-xs text-red-500">{manualError}</p>}
              <div className="flex items-center gap-2">
                <button onClick={submitManual} disabled={loggingManual} className="btn-primary text-sm py-1 px-3">
                  {loggingManual ? 'Saving...' : 'Add entry'}
                </button>
                <button
                  onClick={() => { setShowManual(false); setManualError(''); }}
                  className="btn-ghost text-sm py-1 px-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
                  onClick={() => setPendingDelete(l.id)}
                  className="ml-auto row-action text-ink-muted hover:text-red-500"
                  aria-label="Delete time log"
                >
                  <Icon icon="ph:trash" width={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete this time log?"
          message="The hours come off this task and off the workload report."
          confirmLabel="Delete entry"
          onConfirm={() => {
            removeLog(pendingDelete);
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
