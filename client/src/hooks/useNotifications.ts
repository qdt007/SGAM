import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api/notificationsApi';
import { useNotificationStore } from '../stores/notificationStore';
import { useSocket } from './useSocket';
import { Notification } from '../types';
import { keys } from '../constants/queryKeys';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { setNotifications, addNotification, markRead, markAllRead, clearAll, unreadCount, notifications } =
    useNotificationStore();
  const { on, off } = useSocket();

  const { data, isLoading } = useQuery({
    queryKey: keys.notifications.all,
    queryFn: () => notificationsApi.list(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.data) setNotifications(data.data);
  }, [data, setNotifications]);

  useEffect(() => {
    const handler = (notification: Notification) => {
      addNotification(notification);
      queryClient.invalidateQueries({ queryKey: keys.notifications.all });
    };
    on('notification:new', handler as (...args: unknown[]) => void);
    return () => off('notification:new', handler as (...args: unknown[]) => void);
  }, [on, off, addNotification, queryClient]);

  const { mutate: markAsRead } = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: (_, id) => markRead(id),
  });

  const { mutate: markAllAsRead } = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => markAllRead(),
  });

  const { mutate: clearAllNotifications } = useMutation({
    mutationFn: notificationsApi.clearAll,
    onSuccess: () => {
      clearAll();
      queryClient.invalidateQueries({ queryKey: keys.notifications.all });
    },
  });

  return { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, clearAllNotifications };
}
