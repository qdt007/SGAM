import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { migrateUi, partializeUi, systemTheme, useUIStore, type Theme } from '../stores/uiStore';

/**
 * The theme follows the device until somebody picks one, and the picked one then survives the
 * device changing its mind. Everything below exists to keep those two sentences true — the way
 * they stop being true is subtle: persist the derived value and the app silently stops
 * following the OS for ever, with nothing on screen to say why.
 */

/** jsdom ships no matchMedia, so the OS answer has to be installed by hand. */
function setSystem(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: dark && query.includes('dark'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const base = (over: Partial<Parameters<typeof partializeUi>[0]> = {}) =>
  ({
    sidebarOpen: true,
    activeModal: null,
    modalProps: {},
    theme: 'light' as Theme,
    themeExplicit: false,
    ...over,
  }) as Parameters<typeof partializeUi>[0];

const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');
afterEach(() => {
  if (original) Object.defineProperty(window, 'matchMedia', original);
  vi.restoreAllMocks();
});

describe('systemTheme', () => {
  it('reports what the device asks for', () => {
    setSystem(true);
    expect(systemTheme()).toBe('dark');
    setSystem(false);
    expect(systemTheme()).toBe('light');
  });

  it('falls back to light where matchMedia does not exist', () => {
    // Old browsers and the test environment itself. Throwing here would take the whole app down.
    Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: undefined });
    expect(systemTheme()).toBe('light');
  });
});

describe('what gets written to storage', () => {
  it('omits the theme while no choice has been made', () => {
    // The whole point: a derived value in storage would be read back next launch and would
    // outrank the device, so the app would never notice the setting changing again.
    const saved = partializeUi(base({ theme: 'dark', themeExplicit: false }));
    expect(saved).not.toHaveProperty('theme');
    expect(saved.themeExplicit).toBe(false);
  });

  it('writes the theme down once it was chosen', () => {
    const saved = partializeUi(base({ theme: 'dark', themeExplicit: true }));
    expect(saved.theme).toBe('dark');
    expect(saved.themeExplicit).toBe(true);
  });

  it('keeps the sidebar either way', () => {
    expect(partializeUi(base({ sidebarOpen: false })).sidebarOpen).toBe(false);
  });
});

describe('migrating an install from before the setting existed', () => {
  it('treats a stored dark as a deliberate choice', () => {
    // The old default was light, so dark is something the user went and turned on.
    expect(migrateUi({ sidebarOpen: true, theme: 'dark' }, 0)).toEqual({
      sidebarOpen: true,
      themeExplicit: true,
      theme: 'dark',
    });
  });

  it('treats a stored light as never having been touched', () => {
    // Indistinguishable from the old default, and assuming otherwise would leave every existing
    // install pinned to light for ever.
    const out = migrateUi({ sidebarOpen: true, theme: 'light' }, 0);
    expect(out.themeExplicit).toBe(false);
    expect(out).not.toHaveProperty('theme');
  });

  it('survives an empty or missing record', () => {
    expect(migrateUi(undefined, 0)).toEqual({ sidebarOpen: true, themeExplicit: false });
    expect(migrateUi({}, 0)).toEqual({ sidebarOpen: true, themeExplicit: false });
  });

  it('leaves a current record alone', () => {
    expect(migrateUi({ sidebarOpen: false, themeExplicit: true, theme: 'dark' }, 1)).toEqual({
      sidebarOpen: false,
      themeExplicit: true,
      theme: 'dark',
    });
  });

  it('drops a theme that claims not to have been chosen', () => {
    const out = migrateUi({ sidebarOpen: true, themeExplicit: false, theme: 'dark' }, 1);
    expect(out).not.toHaveProperty('theme');
  });
});

describe('the store actions', () => {
  beforeEach(() => {
    setSystem(false);
    useUIStore.setState({ theme: 'light', themeExplicit: false });
  });

  it('marks the theme explicit when it is toggled', () => {
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState()).toMatchObject({ theme: 'dark', themeExplicit: true });
  });

  it('marks the theme explicit when it is set outright', () => {
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState()).toMatchObject({ theme: 'dark', themeExplicit: true });
  });

  it('hands the decision back to the device', () => {
    useUIStore.getState().setTheme('dark');
    setSystem(true);
    useUIStore.getState().useSystemTheme();
    expect(useUIStore.getState()).toMatchObject({ theme: 'dark', themeExplicit: false });

    setSystem(false);
    useUIStore.getState().useSystemTheme();
    expect(useUIStore.getState()).toMatchObject({ theme: 'light', themeExplicit: false });
  });
});
