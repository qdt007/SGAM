import { NotificationType } from '@prisma/client';
import prisma from '../config/db';
import { emitToUser } from '../config/socket';
import { SOCKET_EVENTS } from '../constants/events';

export interface NotificationJobData { recipientId: string; type: NotificationType; taskId?: string; message: string; }

/** Which preference column gates which notification type. */
const PREF_FIELD: Record<NotificationType, string> = {
  TASK_ASSIGNED: 'taskAssigned',
  TASK_UPDATED: 'taskUpdated',
  TASK_COMMENTED: 'taskCommented',
  MENTIONED: 'mentioned',
  DEADLINE_APPROACHING: 'deadlineApproaching',
  PROJECT_INVITE: 'projectInvite',
  FILE_UPLOADED: 'fileUploaded',
};

/**
 * A user who has never opened Settings has no preference row; the schema defaults
 * then decide, so an absent row means "send it" for every type except FILE_UPLOADED.
 */
export async function wantsNotification(recipientId: string, type: NotificationType): Promise<boolean> {
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: recipientId } });
  if (!prefs) return type !== 'FILE_UPLOADED';
  return (prefs as unknown as Record<string, boolean>)[PREF_FIELD[type]] ?? true;
}

const REDIS_AVAILABLE = !!(process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost') ||
  process.env.REDIS_ENABLED === 'true';

let notificationQueue: { add: (data: NotificationJobData) => Promise<void> } | null = null;

if (REDIS_AVAILABLE) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Bull = require('bull') as typeof import('bull');
    const q = new Bull<NotificationJobData>('notifications', {
      redis: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    });
    q.process(async (job: { data: NotificationJobData }) => {
      const { recipientId, type, taskId, message } = job.data;
      const notification = await prisma.notification.create({ data: { recipientId, type, taskId, message } });
      emitToUser(recipientId, SOCKET_EVENTS.NOTIFICATION_NEW, notification);
    });
    q.on('failed', (job: { id: string }, err: Error) => console.error(`[Notification] Job ${job.id} failed:`, err.message));
    notificationQueue = { add: async (data) => { await q.add(data); } };
    console.log('[Notification] Queue initialized with Redis');
  } catch {
    console.warn('[Notification] Redis not available, notifications disabled');
  }
} else {
  console.log('[Notification] Redis not configured, running without queue');
}

async function processDirectly(data: NotificationJobData): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: { recipientId: data.recipientId, type: data.type, taskId: data.taskId, message: data.message },
    });
    emitToUser(data.recipientId, SOCKET_EVENTS.NOTIFICATION_NEW, notification);
  } catch { /* silent */ }
}

export async function enqueueNotification(data: NotificationJobData): Promise<void> {
  if (!(await wantsNotification(data.recipientId, data.type))) return;
  if (notificationQueue) {
    await notificationQueue.add(data);
  } else {
    await processDirectly(data);
  }
}

export async function fanoutNotification(recipientIds: string[], data: Omit<NotificationJobData, 'recipientId'>): Promise<void> {
  await Promise.all(recipientIds.map((recipientId) => enqueueNotification({ ...data, recipientId })));
}
