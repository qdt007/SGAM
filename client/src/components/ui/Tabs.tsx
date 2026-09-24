import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: string;
  count?: number;
}

/**
 * Underlined tabs, the Ember Studio pattern: the active tab is the only place
 * terracotta appears in this component.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('tabs overflow-x-auto', className)}>
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn('tab', active && 'tab-active')}
          >
            {t.icon && <Icon icon={t.icon} width={16} aria-hidden />}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('badge', active ? 'bg-primary/12 text-primary' : 'badge-neutral')}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
