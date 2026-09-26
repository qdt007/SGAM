import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
interface AuthState { user: User | null; accessToken: string | null; refreshToken: string | null; isAuthenticated: boolean; setAuth:(u:User,t:string,r?:string)=>void; setAccessToken:(t:string,r?:string)=>void; updateUser:(u:Partial<User>)=>void; clearAuth:()=>void; }
export const useAuthStore = create<AuthState>()(persist((set) => ({
  user: null, accessToken: null, refreshToken: null, isAuthenticated: false,
  setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, ...(refreshToken ? { refreshToken } : {}), isAuthenticated: true }),
  // The server rotates the refresh token on every use, so the new one has to replace the old.
  setAccessToken: (accessToken, refreshToken) => set({ accessToken, ...(refreshToken ? { refreshToken } : {}) }),
  updateUser: (updates) => set((s) => ({ user: s.user ? { ...s.user, ...updates } : null })),
  clearAuth: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
}), { name: 'auth-storage', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }) }));
