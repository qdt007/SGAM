import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

/**
 * Shown where a Pro-only feature would be. It explains what is locked and
 * where to unlock it — never a bare error.
 */
export function UpgradePrompt({
  title,
  description,
  features,
  compact,
  className,
}: {
  title: string;
  description?: string;
  features?: string[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon icon="ph:lock-key-duotone" width={24} aria-hidden />
      </span>

      <h2 className="font-display text-subhead font-bold text-ink">{title}</h2>
      {description && <p className="mt-2 max-w-md text-small text-ink-muted">{description}</p>}

      {features && features.length > 0 && (
        <ul className="mt-5 space-y-1.5 text-left">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-small text-ink-muted">
              <Icon icon="ph:check-circle-fill" width={15} className="shrink-0 text-success" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
      )}

      <Link to="/settings?tab=billing" className="btn-primary mt-6">
        <Icon icon="ph:sparkle-duotone" width={16} aria-hidden />
        Nâng cấp lên Pro
      </Link>
      <p className="mt-2 text-caption text-ink-subtle">Từ 49.000 ₫/tháng · huỷ bất cứ lúc nào</p>
    </div>
  );
}

/** Small inline badge for the current plan. */
export function PlanBadge({ tier, className }: { tier: 'FREE' | 'PRO'; className?: string }) {
  if (tier === 'PRO') {
    return (
      <span className={cn('badge bg-primary/12 text-primary', className)}>
        <Icon icon="ph:sparkle-fill" width={11} aria-hidden />
        Pro
      </span>
    );
  }
  return <span className={cn('badge badge-neutral', className)}>Free</span>;
}
