import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface UIState { sidebarOpen:boolean; activeModal:string|null; modalProps:Record<string,unknown>; theme:'light'|'dark'; toggleSidebar:()=>void; setSidebarOpen:(o:boolean)=>void; openModal:(n:string,p?:Record<string,unknown>)=>void; closeModal:()=>void; toggleTheme:()=>void; setTheme:(t:'light'|'dark')=>void; }
export const useUIStore = create<UIState>()(persist((set) => ({
  sidebarOpen: true, activeModal: null, modalProps: {}, theme: 'light',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (name, props={}) => set({ activeModal: name, modalProps: props }),
  closeModal: () => set({ activeModal: null, modalProps: {} }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  setTheme: (theme) => set({ theme }),
}), { name: 'ui-storage', partialize: (s) => ({ sidebarOpen: s.sidebarOpen, theme: s.theme }) }));
