import prisma from '../../config/db';
import { buildPrismaSkipTake, buildMeta } from '../../utils/pagination';

const notificationSelect = {
  id: true, type: true, taskId: true, message: true, isRead: true, createdAt: true,
  task: { select: { id: true, title: true, projectId: true } },
};

export async function list(userId: string, page: number, limit: number, unreadOnly: boolean) {
  const where = { recipientId: userId, ...(unreadOnly && { isRead: false }) };
  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({ where, select: notificationSelect, orderBy: { createdAt: 'desc' }, ...buildPrismaSkipTake(page, limit) }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
  ]);
  return { items, meta: { ...buildMeta(total, page, limit), unreadCount } };
}

export async function getUnreadCount(userId: string) {
  return { unreadCount: await prisma.notification.count({ where: { recipientId: userId, isRead: false } }) };
}

export async function markRead(userId: string, id: string) {
  const { count } = await prisma.notification.updateMany({ where: { id, recipientId: userId }, data: { isRead: true } });
  if (count === 0) throw Object.assign(new Error('Notification not found'), { status: 404 });
}

export async function markAllRead(userId: string) {
  const { count } = await prisma.notification.updateMany({ where: { recipientId: userId, isRead: false }, data: { isRead: true } });
  return { updated: count };
}

export async function remove(userId: string, id: string) {
  const { count } = await prisma.notification.deleteMany({ where: { id, recipientId: userId } });
  if (count === 0) throw Object.assign(new Error('Notification not found'), { status: 404 });
}

export async function clearAll(userId: string) {
  const { count } = await prisma.notification.deleteMany({ where: { recipientId: userId } });
  return { deleted: count };
}
