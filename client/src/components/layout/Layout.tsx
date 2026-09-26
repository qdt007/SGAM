import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { authApi } from '../../api/authApi';
import { cn } from '../../utils/cn';
import { NotificationBell } from '../notifications/NotificationBell';
import { ActiveTimerBadge } from '../timeTracking/ActiveTimerBadge';
import { PlanBadge } from '../billing/UpgradePrompt';
import { usePlan } from '../../hooks/usePlan';
import { Avatar } from '../ui/Avatar';

/* ─── Brand mark ─────────────────────────────────── */
function SgamLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <defs>
        <linearGradient id="sgam-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C2410C" />
          <stop offset="100%" stopColor="#9A3412" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#sgam-grad)" />
      <circle cx="16" cy="11.5" r="3.5" fill="white" />
      <circle cx="9" cy="14.5" r="2.5" fill="white" opacity="0.7" />
      <circle cx="23" cy="14.5" r="2.5" fill="white" opacity="0.7" />
      <path d="M8 27c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="white" />
      <path
        d="M2 27c0-3 2.2-5.5 5-5.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
      <path
        d="M30 27c0-3-2.2-5.5-5-5.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.55"
      />
    </svg>
  );
}
export { SgamLogo };

/* ─── Navigation ─────────────────────────────────── */
const NAV = [
  { to: '/dashboard', icon: 'ph:house-duotone', activeIcon: 'ph:house-fill', label: 'Dashboard' },
  { to: '/projects', icon: 'ph:folders-duotone', activeIcon: 'ph:folders-fill', label: 'Projects' },
];

const NAV_SECONDARY = [
  { to: '/settings', icon: 'ph:gear-six-duotone', activeIcon: 'ph:gear-six-fill', label: 'Settings' },
];

// Shown only to global admins. Hiding it is presentation; the API is what actually refuses.
const NAV_ADMIN = [
  { to: '/admin', icon: 'ph:shield-star-duotone', activeIcon: 'ph:shield-star-fill', label: 'Admin' },
];

function NavSection({ items, collapsed }: { items: typeof NAV; collapsed: boolean }) {
  return (
    <div className="space-y-0.5">
      {items.map(({ to, icon, activeIcon, label }) => (
        <NavLink
          key={to}
          to={to}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn('nav-item', isActive && 'nav-item-active', collapsed && 'justify-center px-0')
          }
        >
          {({ isActive }) => (
            <>
              <Icon icon={isActive ? activeIcon : icon} width={18} className="shrink-0" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

/* ─── Account menu ───────────────────────────────── */
function AccountMenu({ collapsed, onLogout }: { collapsed: boolean; onLogout: () => void }) {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const { tier, isPro } = usePlan();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-150 hover:bg-ink/[0.055]',
          collapsed && 'justify-center',
        )}
      >
        <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{user.displayName}</span>
              <span className="block truncate text-xs text-ink-subtle">{user.email}</span>
            </span>
            <Icon icon="ph:caret-up-down" width={13} className="shrink-0 text-ink-subtle" aria-hidden />
          </>
        )}
      </button>

      {open && (
        <div role="menu" className="menu absolute bottom-full left-0 mb-1.5 w-[230px]">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-caption text-ink-subtle">Gói hiện tại</span>
            <PlanBadge tier={tier} />
          </div>
          {!isPro && (
            <NavLink to="/settings?tab=billing" onClick={() => setOpen(false)} className="menu-item text-primary">
              <Icon icon="ph:sparkle-duotone" width={16} aria-hidden />
              Nâng cấp lên Pro
            </NavLink>
          )}
          <div className="menu-separator" />
          <button
            role="menuitem"
            onClick={() => {
              toggleTheme();
              setOpen(false);
            }}
            className="menu-item"
          >
            <Icon icon={theme === 'dark' ? 'ph:sun-duotone' : 'ph:moon-duotone'} width={16} aria-hidden />
            {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
          </button>
          <div className="menu-separator" />
          <button role="menuitem" onClick={onLogout} className="menu-item text-danger hover:bg-danger/10">
            <Icon icon="ph:sign-out-duotone" width={16} aria-hidden />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Shell ──────────────────────────────────────── */
export function Layout({ children }: { children: React.ReactNode }) {
  const { clearAuth } = useAuthStore();
  // Subscribed rather than read once, so promoting yourself elsewhere reveals the nav entry.
  const isAdmin = useAuthStore((s) => s.user?.globalRole === 'ADMIN');
  const { theme } = useUIStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // The drawer is modal on small screens; closing it on Escape is expected there.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const handleLogout = async () => {
    try {
      const stored = localStorage.getItem('auth-storage');
      const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      /* the local session is cleared either way */
    }
    queryClient.clear();
    clearAuth();
    navigate('/login');
  };

  const sidebar = (mobile: boolean) => {
    const isCollapsed = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col bg-surface">
        <div className={cn('flex h-14 items-center gap-2 px-3', isCollapsed && 'justify-center px-0')}>
          <span className="shrink-0 overflow-hidden rounded-lg">
            <SgamLogo size={28} />
          </span>
          {!isCollapsed && <span className="truncate text-md font-semibold tracking-tight text-ink">SGAM</span>}
          {mobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="btn-ghost btn-icon-sm ml-auto"
              aria-label="Close navigation"
            >
              <Icon icon="ph:x" width={16} aria-hidden />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-2.5 py-2">
          <div>
            {!isCollapsed && <p className="section-label mb-1.5 px-2.5">Workspace</p>}
            <NavSection items={NAV} collapsed={isCollapsed} />
          </div>
          <div>
            {!isCollapsed && <p className="section-label mb-1.5 px-2.5">Account</p>}
            <NavSection items={NAV_SECONDARY} collapsed={isCollapsed} />
          </div>
          {isAdmin && (
            <div>
              {!isCollapsed && <p className="section-label mb-1.5 px-2.5">System</p>}
              <NavSection items={NAV_ADMIN} collapsed={isCollapsed} />
            </div>
          )}
        </nav>

        <div className="border-t border-line-soft p-2.5">
          <AccountMenu collapsed={isCollapsed} onLogout={handleLogout} />
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* Desktop rail */}
      <aside
        className={cn(
          'relative z-40 hidden shrink-0 border-r border-line transition-[width] duration-250 ease-snap lg:block',
          collapsed ? 'w-16' : 'w-[232px]',
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay/45 animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-line shadow-lg animate-slide-in">
            {sidebar(true)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-xl sm:px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="btn-ghost btn-icon-sm lg:hidden"
            aria-label="Open navigation"
          >
            <Icon icon="ph:list" width={18} aria-hidden />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="btn-ghost btn-icon-sm hidden lg:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon icon="ph:sidebar-simple-duotone" width={17} aria-hidden />
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <ActiveTimerBadge />
            <NotificationBell />
          </div>
        </header>

        <main className="relative z-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
