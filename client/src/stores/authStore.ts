import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
interface AuthState { user: User | null; accessToken: string | null; isAuthenticated: boolean; setAuth:(u:User,t:string)=>void; setAccessToken:(t:string)=>void; updateUser:(u:Partial<User>)=>void; clearAuth:()=>void; }
export const useAuthStore = create<AuthState>()(persist((set) => ({
  user: null, accessToken: null, isAuthenticated: false,
  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false }),
}), { name: 'auth-storage', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, isAuthenticated: s.isAuthenticated }) }));
