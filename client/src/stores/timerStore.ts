import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface ActiveTimer { taskId:string; taskTitle:string; startTime:string; timeLogId?:string; }
interface TimerState { activeTimer:ActiveTimer|null; startTimer:(t:string,ti:string,l?:string)=>void; stopTimer:()=>ActiveTimer|null; clearTimer:()=>void; }
export const useTimerStore = create<TimerState>()(persist((set, get) => ({
  activeTimer: null,
  startTimer: (taskId, taskTitle, timeLogId) => set({ activeTimer: { taskId, taskTitle, startTime: new Date().toISOString(), timeLogId } }),
  stopTimer: () => { const t = get().activeTimer; set({ activeTimer: null }); return t; },
  clearTimer: () => set({ activeTimer: null }),
}), { name: 'timer-storage', partialize: (s) => ({ activeTimer: s.activeTimer }) }));
export function getElapsedSeconds(startTime: string): number { return Math.floor((Date.now() - new Date(startTime).getTime()) / 1000); }
