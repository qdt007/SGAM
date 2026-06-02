import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import { Task } from '../types';
export const PIXELS_PER_DAY = 40;
function parse(d: string | Date): Date { return typeof d === 'string' ? parseISO(d) : d; }
export function dateToPixel(date: string | Date, startDate: string | Date, pxPerDay = PIXELS_PER_DAY): number { return differenceInDays(parse(date), parse(startDate)) * pxPerDay; }
export function taskBarWidth(start: string | Date, end: string | Date, pxPerDay = PIXELS_PER_DAY): number { return Math.max(1, differenceInDays(parse(end), parse(start)) + 1) * pxPerDay; }
export function generateTimelineDates(startDate: string | Date, days: number): Date[] { const s = parse(startDate); return Array.from({ length: days }, (_, i) => addDays(s, i)); }
export function formatGanttDate(date: Date, scale: 'day' | 'week' | 'month'): string {
  if (scale === 'day') return format(date, 'd');
  if (scale === 'week') return format(date, 'MMM d');
  return format(date, 'MMM yyyy');
}
export interface GanttRow { task: Task; left: number; width: number; level: number; }
export function buildGanttRows(tasks: Task[], startDate: string | Date, pxPerDay = PIXELS_PER_DAY): GanttRow[] {
  const rows: GanttRow[] = [];
  function processTask(task: Task, level: number): void {
    rows.push({ task, left: task.startDate && task.dueDate ? dateToPixel(task.startDate, startDate, pxPerDay) : 0, width: task.startDate && task.dueDate ? taskBarWidth(task.startDate, task.dueDate, pxPerDay) : pxPerDay, level });
    if (task.subtasks?.length) task.subtasks.forEach((s) => processTask(s, level + 1));
  }
  tasks.filter((t) => !t.parentId).forEach((t) => processTask(t, 0));
  return rows;
}
