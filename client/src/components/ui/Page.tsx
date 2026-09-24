import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

/**
 * One container for every routed screen: same max width, same gutters, same
 * rhythm. Pages that need the full viewport (board, timeline) pass `bleed`.
 */
export function Page({
  children,
  width = 'default',
  bleed,
  className,
}: {
  children: React.ReactNode;
  width?: 'default' | 'narrow' | 'wide';
  bleed?: boolean;
  className?: string;
}) {
  if (bleed) return <div className={cn('flex h-full flex-col overflow-hidden', className)}>{children}</div>;
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 lg:px-8',
        width === 'narrow' ? 'max-w-prose' : width === 'wide' ? 'max-w-[90rem]' : 'max-w-content',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

/** Ancestors only — the current page is named by the title below it. */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cn('flex min-w-0 items-center gap-1 text-sm text-ink-muted', className)}>
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
          {i > 0 && <Icon icon="ph:caret-right" width={12} className="shrink-0 text-ink-subtle" aria-hidden />}
          {c.to ? (
            <Link to={c.to} className="truncate rounded px-0.5 transition-colors hover:text-ink">
              {c.label}
            </Link>
          ) : (
            <span className="truncate">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * The title block every screen opens with. Keeping it in one place is what makes
 * the type scale and the spacing consistent from page to page.
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6', className)}>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} className="mb-2" />}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-ink">{title}</h1>
          {description && <p className="mt-1 text-md text-ink-muted">{description}</p>}
          {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A labelled band inside a page — the alternative to wrapping everything in cards. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('min-w-0', className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h2 className="section-title truncate">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Headline number. Deliberately plain: the value is the only loud thing. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: string;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
}) {
  const toneClass = {
    neutral: 'text-ink-subtle',
    accent: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">{label}</p>
        {icon && <Icon icon={icon} width={15} className={cn('shrink-0', toneClass)} aria-hidden />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>}
    </div>
  );
}
