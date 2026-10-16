import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

/**
 * The OS setting, or light where it cannot be asked (old browsers, a test environment with no
 * matchMedia). Read through a function rather than captured once, so the listener below and the
 * rehydrate step always see the current answer.
 */
export function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export interface PersistedUi {
  sidebarOpen: boolean;
  themeExplicit: boolean;
  theme?: Theme;
}

/**
 * Only a deliberate choice is written down. Persisting a theme that was derived from the OS
 * would freeze it: the next change to the system setting would be overwritten by the stale value
 * on the following load, and the app would never follow the device again.
 */
export function partializeUi(s: UIState): PersistedUi {
  return {
    sidebarOpen: s.sidebarOpen,
    themeExplicit: s.themeExplicit,
    ...(s.themeExplicit ? { theme: s.theme } : {}),
  };
}

/**
 * Version 0 had no `themeExplicit` and always stored a theme, so an old record cannot say
 * whether its value was chosen or inherited. It can be inferred: the old default was light, so a
 * stored `dark` is something the user went and turned on, while a stored `light` is
 * indistinguishable from never having touched it. Treating light as not-explicit is what lets an
 * existing install start following the OS.
 *
 * Leaving `theme` out of the result is deliberate — the store's initial value is already
 * systemTheme(), and omitting the key lets it stand rather than pinning a copy of it.
 */
export function migrateUi(persisted: unknown, version: number): PersistedUi {
  const s = (persisted ?? {}) as Partial<UIState>;
  const sidebarOpen = s.sidebarOpen ?? true;
  if (version === 0) {
    return s.theme === 'dark'
      ? { sidebarOpen, themeExplicit: true, theme: 'dark' }
      : { sidebarOpen, themeExplicit: false };
  }
  return {
    sidebarOpen,
    themeExplicit: s.themeExplicit ?? false,
    ...(s.themeExplicit && s.theme ? { theme: s.theme } : {}),
  };
}

interface UIState {
  sidebarOpen: boolean;
  activeModal: string | null;
  modalProps: Record<string, unknown>;
  /** The theme in force. Derived from the OS until the user picks one. */
  theme: Theme;
  /**
   * True once someone chose a theme themselves. It is what separates "dark because the phone is
   * dark" from "dark because I asked for dark", and only the second survives a change to the
   * system setting.
   */
  themeExplicit: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (o: boolean) => void;
  openModal: (n: string, p?: Record<string, unknown>) => void;
  closeModal: () => void;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  /** Hands the decision back to the OS and starts following it again. */
  useSystemTheme: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      activeModal: null,
      modalProps: {},
      theme: systemTheme(),
      themeExplicit: false,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      openModal: (name, props = {}) => set({ activeModal: name, modalProps: props }),
      closeModal: () => set({ activeModal: null, modalProps: {} }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light', themeExplicit: true })),
      setTheme: (theme) => set({ theme, themeExplicit: true }),
      useSystemTheme: () => set({ theme: systemTheme(), themeExplicit: false }),
    }),
    {
      name: 'ui-storage',
      version: 1,
      partialize: partializeUi,
      migrate: migrateUi,
    },
  ),
);

/**
 * Follow the system while no explicit choice is in force. Registered once at module load, which
 * is also why `systemTheme()` is re-read here rather than closed over — the user can flip the OS
 * setting at any point in the session.
 */
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!useUIStore.getState().themeExplicit) {
      useUIStore.setState({ theme: e.matches ? 'dark' : 'light' });
    }
  });
}
