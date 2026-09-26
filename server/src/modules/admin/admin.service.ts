import { GlobalRole, PaymentStatus, PlanTier } from '@prisma/client';
import prisma from '../../config/db';
import { UpdateUserInput } from './admin.schema';

const DAYS = 14;

const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  globalRole: true,
  isActive: true,
  createdAt: true,
  _count: { select: { projectMemberships: true, assignedTasks: true } },
  subscription: { select: { tier: true, status: true, currentPeriodEnd: true } },
};

/** Midnight boundaries for the last N days, oldest first — the x-axis of the signups chart. */
function recentDays(n: number): Date[] {
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

export async function getStats() {
  const days = recentDays(DAYS);
  const since = days[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    users,
    activeUsers,
    admins,
    newThisWeek,
    projects,
    tasks,
    doneTasks,
    overdueTasks,
    proSubs,
    payments,
    signups,
    tasksByStatus,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { globalRole: GlobalRole.ADMIN } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.project.count(),
    prisma.task.count({ where: { parentId: null } }),
    prisma.task.count({ where: { parentId: null, status: 'DONE' } }),
    prisma.task.count({
      where: { parentId: null, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: new Date() } },
    }),
    prisma.subscription.count({ where: { tier: PlanTier.PRO, status: 'ACTIVE' } }),
    prisma.payment.aggregate({ where: { status: PaymentStatus.PAID }, _sum: { amount: true }, _count: true }),
    // One query for the whole window; bucketing in JS beats 14 round trips.
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.task.groupBy({ by: ['status'], where: { parentId: null }, _count: { _all: true } }),
  ]);

  const signupSeries = days.map((day) => {
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    return {
      date: day.toISOString().slice(0, 10),
      count: signups.filter((u) => u.createdAt >= day && u.createdAt < next).length,
    };
  });

  return {
    users: { total: users, active: activeUsers, admins, newThisWeek },
    projects: { total: projects },
    tasks: {
      total: tasks,
      done: doneTasks,
      overdue: overdueTasks,
      byStatus: tasksByStatus.map((t) => ({ status: t.status, count: t._count._all })),
    },
    billing: {
      proSubscriptions: proSubs,
      paidPayments: payments._count,
      revenue: payments._sum.amount ?? 0,
    },
    signupSeries,
  };
}

export async function listUsers(query: { q?: string; page: number; limit: number }) {
  const q = query.q?.trim();
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
          { displayName: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
}

/**
 * Changes a user's global role or disables their account.
 *
 * Two things are refused outright: an admin acting on their own account, and removing the last
 * admin. Either one can lock every administrator out of the system, and there is no recovery
 * path from inside the app.
 */
export async function updateUser(actorId: string, targetId: string, input: UpdateUserInput) {
  if (actorId === targetId) {
    throw Object.assign(new Error('You cannot change your own role or status here'), { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, globalRole: true, isActive: true },
  });
  if (!target) throw Object.assign(new Error('User not found'), { status: 404 });

  const losesAdmin =
    target.globalRole === GlobalRole.ADMIN &&
    ((input.globalRole !== undefined && input.globalRole !== GlobalRole.ADMIN) || input.isActive === false);

  if (losesAdmin) {
    const remaining = await prisma.user.count({
      where: { globalRole: GlobalRole.ADMIN, isActive: true, NOT: { id: targetId } },
    });
    if (remaining === 0) {
      throw Object.assign(new Error('This is the last active admin — promote someone else first'), { status: 409 });
    }
  }

  const user = await prisma.user.update({ where: { id: targetId }, data: input, select: userSelect });

  // A disabled account keeps its sessions alive until each access token expires; dropping the
  // refresh tokens is what actually ends them.
  if (input.isActive === false) {
    await prisma.refreshToken.deleteMany({ where: { userId: targetId } });
  }

  return user;
}
