import { create } from 'zustand';
import { Notification } from '../types';
interface NotificationState { notifications:Notification[]; unreadCount:number; setNotifications:(n:Notification[])=>void; addNotification:(n:Notification)=>void; markRead:(id:string)=>void; markAllRead:()=>void; removeNotification:(id:string)=>void; clearAll:()=>void; }
export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [], unreadCount: 0,
  setNotifications: (notifications) => set({ notifications, unreadCount: notifications.filter((n)=>!n.isRead).length }),
  addNotification: (notification) => set((s) => ({ notifications: [notification,...s.notifications], unreadCount: notification.isRead ? s.unreadCount : s.unreadCount+1 })),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n)=>n.id===id?{...n,isRead:true}:n), unreadCount: Math.max(0,s.unreadCount-1) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n)=>({...n,isRead:true})), unreadCount: 0 })),
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
  removeNotification: (id) => set((s) => { const n = s.notifications.find((n)=>n.id===id); return { notifications: s.notifications.filter((n)=>n.id!==id), unreadCount: n&&!n.isRead ? Math.max(0,s.unreadCount-1) : s.unreadCount }; }),
}));
