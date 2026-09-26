import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

/**
 * Keeps non-admins out of the admin screen. This is a courtesy, not a control — the guard that
 * matters is `authorize(ADMIN)` on the API, which every admin route sits behind. Someone who
 * edits their stored user to say ADMIN gets the page and nothing but 403s on it.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const isAdmin = useAuthStore((s) => s.user?.globalRole === 'ADMIN');
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
