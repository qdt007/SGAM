import { format, formatDistanceToNow, isPast, differenceInDays, isToday, isTomorrow, parseISO } from 'date-fns';
function parse(d: string | Date): Date { return typeof d === 'string' ? parseISO(d) : d; }
export function formatDate(date: string | Date | null | undefined, fmt = 'MMM d, yyyy'): string { if (!date) return '-'; return format(parse(date), fmt); }
export function formatRelative(date: string | Date | null | undefined): string { if (!date) return '-'; return formatDistanceToNow(parse(date), { addSuffix: true }); }
export function isOverdue(dueDate: string | Date | null | undefined): boolean { if (!dueDate) return false; const d = parse(dueDate); return isPast(d) && !isToday(d); }
export function daysUntil(date: string | Date | null | undefined): number | null { if (!date) return null; return differenceInDays(parse(date), new Date()); }
export function dueDateLabel(date: string | Date | null | undefined): string {
  if (!date) return 'No due date';
  const d = parse(date);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const days = differenceInDays(d, new Date());
  if (days < 0) return Math.abs(days) + ' days overdue';
  if (days <= 7) return 'In ' + days + ' days';
  return formatDate(d);
}
export function durationFromMinutes(minutes: number): string {
  if (minutes < 60) return minutes + 'm';
  const h = Math.floor(minutes / 60); const m = minutes % 60;
  return m > 0 ? h + 'h ' + m + 'm' : h + 'h';
}
