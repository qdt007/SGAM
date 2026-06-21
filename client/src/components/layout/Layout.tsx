import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Settings, LogOut, Sun, Moon, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { authApi } from '../../api/authApi';
import { cn } from '../../utils/cn';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();
  const { theme, toggleTheme } = useUIStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    try {
      const stored = localStorage.getItem('auth-storage');
      const refreshToken = stored ? JSON.parse(stored)?.state?.refreshToken : null;
      if (refreshToken) await authApi.logout(refreshToken);
    } catch { /* ignore */ }
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <aside className={cn(
        'flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200',
        sidebarOpen ? 'w-56' : 'w-14'
      )}>
        <div className="flex h-14 items-center justify-between px-3 border-b border-gray-200 dark:border-gray-800">
          {sidebarOpen && (
            <span className="font-bold text-primary-600 text-base truncate">ProjectHub</span>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="btn-ghost p-1.5 rounded-lg ml-auto">
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              )}
            >
              <Icon size={16} className="shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-2 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <button onClick={toggleTheme} className={cn('btn-ghost w-full text-sm', sidebarOpen ? 'justify-start' : 'justify-center px-2')}>
            {theme === 'dark' ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
            {sidebarOpen && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          <button onClick={handleLogout} className={cn('btn-ghost w-full text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20', sidebarOpen ? 'justify-start' : 'justify-center px-2')}>
            <LogOut size={16} className="shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>

        {sidebarOpen && user && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {user.displayName?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate dark:text-white">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
