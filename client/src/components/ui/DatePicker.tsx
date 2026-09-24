import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isValid } from 'date-fns';
import { Calendar, X, Clock } from 'lucide-react';
import { cn } from '../../utils/cn';
import { DrumColumn } from './TimeDrum';
import 'react-day-picker/dist/style.css';

interface DatePickerProps {
  value?: string;
  onChange: (iso: string) => void;
  onClear?: () => void;
  label?: string;
  placeholder?: string;
  className?: string;
  minDate?: Date;
  showTime?: boolean;
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') + 'h' }));
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
  value: m,
  label: ':' + String(m).padStart(2, '0'),
}));

export function DatePicker({
  value,
  onChange,
  onClear,
  label,
  placeholder = 'Pick a date & time',
  className,
  minDate,
  showTime = true,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const selected = value ? new Date(value) : undefined;
  const isValidDate = selected && isValid(selected);

  const [hour, setHour] = useState(selected?.getHours() ?? 9);
  const [minute, setMinute] = useState(selected?.getMinutes() ?? 0);

  useEffect(() => {
    if (selected && isValid(selected)) {
      setHour(selected.getHours());
      setMinute(selected.getMinutes());
    }
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropUp(window.innerHeight - rect.bottom < 520 && rect.top > window.innerHeight - rect.bottom);
  }, [open]);

  const buildDate = (day: Date, h: number, m: number) => {
    const d = new Date(day);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };

  const handleSelectDay = (day: Date | undefined) => {
    if (!day) return;
    onChange(buildDate(day, hour, minute));
  };

  const handleHour = (h: number) => {
    setHour(h);
    if (selected && isValid(selected)) onChange(buildDate(selected, h, minute));
  };

  const handleMinute = (m: number) => {
    setMinute(m);
    if (selected && isValid(selected)) onChange(buildDate(selected, hour, m));
  };

  const handlePreset = (daysFromNow: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setHour(h);
    setMinute(m);
    onChange(buildDate(d, h, m));
  };

  const isOverdue = isValidDate && selected! < new Date();
  const displayStr = isValidDate
    ? showTime
      ? format(selected!, 'MMM d, yyyy · HH:mm')
      : format(selected!, 'MMM d, yyyy')
    : placeholder;

  return (
    <div className={cn('relative', className)} ref={ref}>
      {label && <label className="label mb-1 block">{label}</label>}

      {/* Trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-left rounded-[11px] transition-all duration-150',
          'bg-raised border border-hairline',
          open ? 'border-primary ring-2 ring-primary-500/20' : 'hover:border-line-strong dark:hover:border-white/25',
          isOverdue && !open && '!border-red-300',
        )}
      >
        <Calendar
          size={15}
          className={cn('shrink-0', isValidDate ? (isOverdue ? 'text-red-500' : 'text-primary') : 'text-ink-muted')}
        />
        <span
          className={cn(
            'flex-1 truncate font-medium',
            isValidDate ? (isOverdue ? 'text-red-500' : 'text-ink') : 'text-ink-muted',
          )}
        >
          {displayStr}
        </span>
        {isValidDate && showTime && (
          <span className="shrink-0 text-xs text-ink-muted flex items-center gap-1">
            <Clock size={11} /> {format(selected!, 'HH:mm')}
          </span>
        )}
        {isValidDate && onClear && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="shrink-0 text-ink-muted hover:text-ink dark:hover:text-white transition-colors ml-1"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {/* Popup */}
      <div
        className={cn(
          'absolute z-[200] rounded-xl border border-black/[0.06] bg-raised shadow-modal overflow-hidden w-max',
          'transition-all duration-200',
          dropUp ? 'bottom-full mb-2 origin-bottom-left' : 'top-full mt-1.5 origin-top-left',
          open ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none',
        )}
      >
        {/* Apple-style calendar theme */}
        <style>{`
 .rdp { --rdp-cell-size:38px; --rdp-accent-color:#C2410C; --rdp-background-color:#FFEDD5; margin:0; }
 .rdp-months { padding:14px 14px 8px; }
 .rdp-caption { padding:0 4px 10px; }
 .rdp-caption_label { font-weight:600; font-size:0.9rem; color:#1d1d1f; letter-spacing:-0.01em; }
 .dark .rdp-caption_label { color:#f5f5f7; }
 .rdp-head_cell { font-size:0.7rem; font-weight:500; color:#7a7a7a; }
 .rdp-day { border-radius:10px !important; font-size:0.82rem; font-weight:400; color:#1d1d1f; transition:all 0.12s; }
 .dark .rdp-day { color:#e8e8ea; }
 .rdp-day:hover:not(.rdp-day_selected) { background:#f0f0f0; }
 .dark .rdp-day:hover:not(.rdp-day_selected) { background:rgba(255,255,255,0.08); }
 .rdp-day_selected { background:#C2410C !important; color:#fff !important; font-weight:600; }
 .rdp-day_today:not(.rdp-day_selected) { color:#C2410C; font-weight:700; }
 .rdp-day_outside { color:#c4c4c6 !important; }
 .rdp-nav_button { border-radius:8px !important; color:#C2410C; }
 .rdp-nav_button:hover { background:#f0f0f0; }
 .dark .rdp-nav_button:hover { background:rgba(255,255,255,0.08); }
 `}</style>

        {/* Quick presets */}
        <div className="flex gap-1.5 px-3.5 pt-3.5 pb-2.5 border-b border-hairline flex-wrap">
          {[
            { label: 'Today 9am', d: 0, h: 9 },
            { label: 'Today 5pm', d: 0, h: 17 },
            { label: '+1d 9am', d: 1, h: 9 },
            { label: '+3d', d: 3, h: 9 },
            { label: '+1w', d: 7, h: 9 },
            { label: '+1m', d: 30, h: 9 },
          ].map(({ label, d, h }) => (
            <button
              key={label}
              type="button"
              onClick={() => handlePreset(d, h, 0)}
              className="px-3 py-1 rounded-full text-xs font-medium text-ink-muted bg-canvas-parchment hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex">
          {/* Calendar */}
          <DayPicker
            mode="single"
            selected={isValidDate ? selected : undefined}
            onSelect={handleSelectDay}
            disabled={minDate ? { before: minDate } : undefined}
            showOutsideDays
          />

          {/* Drum time picker */}
          {showTime && (
            <div className="border-l border-hairline flex flex-col py-4 px-5 gap-3 items-center justify-center bg-canvas-parchment dark:bg-white/[0.03]">
              <div className="flex items-center gap-1 mb-0.5">
                <Clock size={12} className="text-primary" />
                <span className="text-[11px] font-medium text-ink-muted">Time</span>
              </div>

              {/* Current time display */}
              <div className="text-2xl font-semibold text-ink text-center mb-1 tabular-nums tracking-tight">
                {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')}
              </div>

              {/* Drum wheels */}
              <div className="flex gap-3 items-center">
                <DrumColumn items={HOURS} value={hour} onChange={handleHour} label="Hour" />
                <span className="text-2xl font-semibold text-primary mb-4">:</span>
                <DrumColumn items={MINUTES} value={minute} onChange={handleMinute} label="Min" />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3.5 py-3 border-t border-hairline flex items-center justify-between gap-2 bg-canvas-parchment dark:bg-white/[0.03]">
          <span className="text-xs text-ink-muted">
            {isValidDate ? format(selected!, showTime ? 'EEE, MMM d · HH:mm' : 'EEE, MMM d, yyyy') : 'No date selected'}
          </span>
          <button type="button" onClick={() => setOpen(false)} className="btn-primary text-xs !py-1.5 !px-5">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
