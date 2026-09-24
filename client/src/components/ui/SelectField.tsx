import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  color?: string; // dot color e.g. 'bg-green-500'
  textColor?: string; // text color class
  bgColor?: string; // badge bg color
  iconifyIcon?: string; // Iconify icon id e.g. 'ph:circle-duotone'
  iconColor?: string; // icon color e.g. 'text-green-500'
  icon?: React.ReactNode;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  label,
  className,
  size = 'md',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const popupHeight = options.length * 40 + 16;
    setDropUp(spaceBelow < popupHeight && rect.top > spaceBelow);
  }, [open, options.length]);

  return (
    <div className={cn('relative', open && 'z-50', className)} ref={ref}>
      {label && <label className="label mb-1 block">{label}</label>}

      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded-lg border border-line bg-raised text-left transition-all duration-150',
          'hover:border-line-strong',
          open && 'border-primary ring-2 ring-primary/20',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              {selected.iconifyIcon && (
                <Icon icon={selected.iconifyIcon} width={16} className={cn('shrink-0', selected.iconColor)} />
              )}
              {!selected.iconifyIcon && selected.color && (
                <span className={cn('h-2 w-2 rounded-full shrink-0', selected.color)} />
              )}
              {selected.icon && <span className="shrink-0">{selected.icon}</span>}
              <span className={cn('font-medium truncate', selected.textColor ?? 'text-ink')}>{selected.label}</span>
            </>
          ) : (
            <span className="text-ink-subtle">{placeholder ?? 'Select...'}</span>
          )}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={cn('shrink-0 text-ink-subtle transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown — mounted only while open */}
      {open && (
        <div
          role="listbox"
          className={cn(
            'absolute z-[200] w-full min-w-[160px] overflow-hidden rounded-xl border border-line bg-raised shadow-selected',
            'animate-scale-in',
            dropUp ? 'bottom-full mb-1.5 origin-bottom' : 'top-full mt-1.5 origin-top',
          )}
        >
          <div className="max-h-64 space-y-0.5 overflow-y-auto p-1">
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                  size === 'sm' ? 'text-caption' : 'text-small',
                  isActive ? 'bg-primary/10 font-semibold text-primary' : 'text-ink-muted hover:bg-ink/[0.06] hover:text-ink',
                )}
              >
                {opt.iconifyIcon ? (
                  <Icon icon={opt.iconifyIcon} width={16} className={cn('shrink-0', opt.iconColor)} />
                ) : opt.color ? (
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', opt.color)} />
                ) : null}
                {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                <span className={cn('flex-1 font-medium', opt.textColor)}>{opt.label}</span>
                {isActive && <Icon icon="ph:check-bold" width={13} className="ml-auto shrink-0 text-primary" />}
              </button>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

// Pre-built option sets with Iconify icons
export const STATUS_OPTIONS: SelectOption[] = [
  {
    value: 'BACKLOG',
    label: 'Backlog',
    iconifyIcon: 'ph:tray-duotone',
    iconColor: 'text-ink-subtle',
    textColor: 'text-ink-muted',
  },
  {
    value: 'TODO',
    label: 'To Do',
    iconifyIcon: 'ph:circle-dashed-duotone',
    iconColor: 'text-blue-400',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    iconifyIcon: 'ph:arrow-circle-right-duotone',
    iconColor: 'text-yellow-500',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    value: 'IN_REVIEW',
    label: 'In Review',
    iconifyIcon: 'ph:magnifying-glass-duotone',
    iconColor: 'text-purple-400',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
  {
    value: 'DONE',
    label: 'Done',
    iconifyIcon: 'ph:check-circle-duotone',
    iconColor: 'text-green-500',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    iconifyIcon: 'ph:x-circle-duotone',
    iconColor: 'text-red-400',
    textColor: 'text-red-500 dark:text-red-400',
  },
];

export const PRIORITY_OPTIONS: SelectOption[] = [
  {
    value: 'CRITICAL',
    label: 'Critical',
    iconifyIcon: 'ph:warning-octagon-duotone',
    iconColor: 'text-red-500',
    textColor: 'text-red-600 dark:text-red-400',
  },
  {
    value: 'HIGH',
    label: 'High',
    iconifyIcon: 'ph:arrow-up-duotone',
    iconColor: 'text-orange-400',
    textColor: 'text-orange-600 dark:text-orange-400',
  },
  {
    value: 'MEDIUM',
    label: 'Medium',
    iconifyIcon: 'ph:equals-duotone',
    iconColor: 'text-yellow-500',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    value: 'LOW',
    label: 'Low',
    iconifyIcon: 'ph:arrow-down-duotone',
    iconColor: 'text-green-400',
    textColor: 'text-green-600 dark:text-green-400',
  },
];

export const PROJECT_STATUS_OPTIONS: SelectOption[] = [
  {
    value: 'PLANNING',
    label: 'Planning',
    iconifyIcon: 'ph:compass-duotone',
    iconColor: 'text-ink-subtle',
    textColor: 'text-ink-muted',
  },
  {
    value: 'ACTIVE',
    label: 'Active',
    iconifyIcon: 'ph:lightning-duotone',
    iconColor: 'text-green-500',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'ON_HOLD',
    label: 'On Hold',
    iconifyIcon: 'ph:pause-circle-duotone',
    iconColor: 'text-yellow-500',
    textColor: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    iconifyIcon: 'ph:trophy-duotone',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
    iconifyIcon: 'ph:prohibit-duotone',
    iconColor: 'text-red-400',
    textColor: 'text-red-500 dark:text-red-400',
  },
];
