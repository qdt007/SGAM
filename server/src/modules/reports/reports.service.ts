import prisma from '../../config/db';
import { BurndownQuery } from './reports.schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Daily remaining-work curve against an ideal straight line.
 * Remaining for a day = tasks that existed by then and were not yet completed by then.
 */
export async function burndown(projectId: string, query: BurndownQuery) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, startDate: true, endDate: true, createdAt: true },
  });
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });

  const tasks = await prisma.task.findMany({
    where: { projectId, parentId: null, status: { not: 'CANCELLED' } },
    select: { id: true, createdAt: true, completedAt: true, estimatedHrs: true },
  });

  const from = startOfDay(new Date(query.from ?? project.startDate ?? project.createdAt));
  const to = startOfDay(new Date(query.to ?? project.endDate ?? new Date()));
  const end = to < from ? from : to;
  const today = startOfDay(new Date());

  const totalDays = Math.round((end.getTime() - from.getTime()) / DAY_MS) + 1;
  const total = tasks.length;

  const points = Array.from({ length: Math.min(totalDays, 180) }, (_, i) => {
    const day = new Date(from.getTime() + i * DAY_MS);
    const dayEnd = new Date(day.getTime() + DAY_MS);
    const existing = tasks.filter((t) => t.createdAt < dayEnd).length;
    const completed = tasks.filter((t) => t.completedAt && t.completedAt < dayEnd).length;
    return {
      date: day.toISOString().slice(0, 10),
      remaining: day > today ? null : existing - completed,
      completed: day > today ? null : completed,
      ideal: Math.round((total - (total * i) / Math.max(1, totalDays - 1)) * 10) / 10,
    };
  });

  return {
    project: { id: project.id, name: project.name },
    from: from.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    total,
    completed: tasks.filter((t) => t.completedAt).length,
    points,
  };
}

/** Per-member open/done/overdue counts plus logged hours, for the workload report. */
export async function workload(projectId: string) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    select: { role: true, user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId, parentId: null, status: { not: 'CANCELLED' } },
    select: { assigneeId: true, status: true, dueDate: true, estimatedHrs: true },
  });

  const logs = await prisma.timeLog.groupBy({
    by: ['userId'],
    where: { task: { projectId } },
    _sum: { durationMin: true },
  });
  const minutesByUser = new Map(logs.map((l) => [l.userId, l._sum.durationMin ?? 0]));
  const now = new Date();

  const rows = members.map((m) => {
    const mine = tasks.filter((t) => t.assigneeId === m.user.id);
    const open = mine.filter((t) => t.status !== 'DONE');
    return {
      user: m.user,
      role: m.role,
      total: mine.length,
      open: open.length,
      done: mine.filter((t) => t.status === 'DONE').length,
      overdue: open.filter((t) => t.dueDate && t.dueDate < now).length,
      estimatedHrs: Math.round(mine.reduce((s, t) => s + (t.estimatedHrs ?? 0), 0) * 10) / 10,
      loggedHrs: Math.round(((minutesByUser.get(m.user.id) ?? 0) / 60) * 10) / 10,
    };
  });

  const unassigned = tasks.filter((t) => !t.assigneeId);
  return {
    rows: rows.sort((a, b) => b.open - a.open),
    unassigned: { total: unassigned.length, open: unassigned.filter((t) => t.status !== 'DONE').length },
  };
}

/** Headline numbers for the reports page and the project card. */
export async function summary(projectId: string) {
  const [byStatus, byPriority, tasks, loggedMin] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], where: { projectId, parentId: null }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['priority'], where: { projectId, parentId: null }, _count: { _all: true } }),
    prisma.task.findMany({ where: { projectId, parentId: null }, select: { status: true, dueDate: true, estimatedHrs: true } }),
    prisma.timeLog.aggregate({ where: { task: { projectId } }, _sum: { durationMin: true } }),
  ]);

  const now = new Date();
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;

  return {
    total,
    done,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    overdue: tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED' && t.dueDate && t.dueDate < now).length,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    estimatedHrs: Math.round(tasks.reduce((s, t) => s + (t.estimatedHrs ?? 0), 0) * 10) / 10,
    loggedHrs: Math.round(((loggedMin._sum.durationMin ?? 0) / 60) * 10) / 10,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count._all])),
  };
}
