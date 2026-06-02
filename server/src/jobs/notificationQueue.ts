import Bull from 'bull';
import { NotificationType } from '@prisma/client';
import prisma from '../config/db';
import { emitToUser } from '../config/socket';
import { SOCKET_EVENTS } from '../constants/events';
export interface NotificationJobData { recipientId: string; type: NotificationType; taskId?: string; message: string; }
export const notificationQueue = new Bull<NotificationJobData>('notifications', {
  redis: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
});
notificationQueue.process(async (job) => {
  const { recipientId, type, taskId, message } = job.data;
  const notification = await prisma.notification.create({ data: { recipientId, type, taskId, message } });
  emitToUser(recipientId, SOCKET_EVENTS.NOTIFICATION_NEW, notification);
});
notificationQueue.on('failed', (job, err) => console.error(`[Notification] Job ${job.id} failed:`, err.message));
export async function enqueueNotification(data: NotificationJobData): Promise<void> { await notificationQueue.add(data); }
export async function fanoutNotification(recipientIds: string[], data: Omit<NotificationJobData, 'recipientId'>): Promise<void> {
  await Promise.all(recipientIds.map((recipientId) => notificationQueue.add({ ...data, recipientId })));
}
