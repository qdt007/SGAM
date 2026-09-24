import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

/* The three states every data surface needs, so no screen invents its own again. */

export function EmptyState({
  icon = 'ph:tray-duotone',
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-14', className)}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-ink/[0.05] text-ink-subtle">
        <Icon icon={icon} width={22} aria-hidden />
      </div>
      <p className="text-md font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
  compact,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-14')}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-danger/10 text-danger">
        <Icon icon="ph:warning-circle-duotone" width={22} aria-hidden />
      </div>
      <p className="text-md font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary btn-sm mt-4">
          <Icon icon="ph:arrow-clockwise" width={14} aria-hidden />
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline error for forms and mutations — sits above the fields it explains. */
export function InlineError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/[0.07] px-3 py-2.5 text-sm text-danger',
        className,
      )}
    >
      <Icon icon="ph:warning-circle-fill" width={15} className="mt-px shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

/** Placeholder rows that match the shape of the list they stand in for. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('divide-y divide-line-soft', className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('spinner', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3">
      <Spinner size={22} />
      <p className="text-sm text-ink-subtle">{label}</p>
    </div>
  );
}
