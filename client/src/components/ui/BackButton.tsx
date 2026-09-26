import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Goes back through history when there is app history to go back to, and to `to` otherwise —
 * which is the case when the page was opened from a link, a bookmark or a notification, where
 * `navigate(-1)` would throw the user out of the app entirely.
 *
 * Uses lucide rather than Iconify on purpose: Iconify fetches icon data at runtime, so an icon
 * used nowhere else renders as an empty box until that request lands. lucide ships in the bundle.
 */
export function BackButton({ to, label = 'Back', className }: { to: string; label?: string; className?: string }) {
  const navigate = useNavigate();
  const hasHistory = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;

  return (
    <button
      onClick={() => (hasHistory ? navigate(-1) : navigate(to))}
      aria-label={label}
      title={label}
      className={cn('btn-ghost btn-icon-sm shrink-0 text-ink-muted hover:text-ink', className)}
    >
      <ArrowLeft size={17} aria-hidden />
    </button>
  );
}
