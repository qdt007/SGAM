import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from '../../hooks/useNotifications';
import { notificationsApi } from '../../api/notificationsApi';
import { formatRelative } from '../../utils/dateUtils';
import { keys } from '../../constants/queryKeys';
import { NotificationType } from '../../types';
import { cn } from '../../utils/cn';
import { ConfirmDialog } from '../ui/Modal';

const TYPE_ICON: Record<NotificationType, { icon: string; color: string }> = {
  TASK_ASSIGNED: { icon: 'ph:user-focus-duotone', color: 'text-primary' },
  TASK_UPDATED: { icon: 'ph:pencil-simple-duotone', color: 'text-amber-500' },
  TASK_COMMENTED: { icon: 'ph:chat-circle-dots-duotone', color: 'text-violet-500' },
  MENTIONED: { icon: 'ph:at-duotone', color: 'text-pink-500' },
  DEADLINE_APPROACHING: { icon: 'ph:clock-countdown-duotone', color: 'text-red-500' },
  PROJECT_INVITE: { icon: 'ph:users-three-duotone', color: 'text-emerald-500' },
  FILE_UPLOADED: { icon: 'ph:paperclip-duotone', color: 'text-sky-500' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAllNotifications } = useNotifications();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleOpen = (id: string, isRead: boolean, taskId?: string | null, projectId?: string) => {
    if (!isRead) markAsRead(id);
    setOpen(false);
    if (projectId) navigate(`/projects/${projectId}${taskId ? `?task=${taskId}` : ''}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await notificationsApi.delete(id);
    queryClient.invalidateQueries({ queryKey: keys.notifications.all });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost relative p-2"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
      >
        <Icon icon={unreadCount > 0 ? 'ph:bell-ringing-duotone' : 'ph:bell-duotone'} width={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[calc(100vw-2rem)] z-50 rounded-xl border border-black/[0.06] bg-raised shadow-modal overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="text-xs text-primary hover:underline dark:text-primary"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-ink-muted hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Icon icon="ph:bell-slash-duotone" width={28} className="mx-auto text-ink-muted mb-2" />
                <p className="text-sm text-ink-muted">You're all caught up.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_ICON[n.type] ?? TYPE_ICON.TASK_UPDATED;
                const projectId = (n as { task?: { projectId?: string } }).task?.projectId;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleOpen(n.id, n.isRead, n.taskId, projectId)}
                    className={cn(
                      'group flex gap-3 px-4 py-3 cursor-pointer border-b border-hairline-soft last:border-0 transition-colors',
                      'hover:bg-black/[0.03] dark:border-white/[0.06] dark:hover:bg-white/[0.05]',
                      !n.isRead && 'bg-primary/[0.04] dark:bg-primary/[0.08]',
                    )}
                  >
                    <Icon icon={meta.icon} width={20} className={cn('shrink-0 mt-0.5', meta.color)} />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm leading-snug text-ink', !n.isRead && 'font-medium')}>{n.message}</p>
                      <p className="text-xs text-ink-muted mt-0.5">{formatRelative(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, n.id)}
                      className="row-action text-ink-muted hover:text-red-500"
                      aria-label="Delete notification"
                    >
                      <Icon icon="ph:x" width={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="Clear all notifications?"
          message="Every notification is deleted, read or not. The tasks and comments they point at are untouched."
          confirmLabel="Clear all"
          onConfirm={() => {
            clearAllNotifications();
            setConfirmClear(false);
            setOpen(false);
          }}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
