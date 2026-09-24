import { NotificationType } from '@prisma/client';
import prisma from '../config/db';
import { sendMail } from '../config/mailer';
import { wantsNotification } from './notificationQueue';

export interface EmailJobData { to: string; subject: string; html: string; }

const REDIS_AVAILABLE = !!(process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost') ||
  process.env.REDIS_ENABLED === 'true';

let emailQueue: { add: (data: EmailJobData) => Promise<void> } | null = null;

if (REDIS_AVAILABLE) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Bull = require('bull') as typeof import('bull');
    const q = new Bull<EmailJobData>('email', {
      redis: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 },
    });
    q.process(async (job: { data: EmailJobData }) => { await sendMail(job.data); console.log(`[Email] Sent to ${job.data.to}`); });
    q.on('failed', (job: { id: string }, err: Error) => console.error(`[Email] Job ${job.id} failed:`, err.message));
    emailQueue = { add: async (data) => { await q.add(data); } };
    console.log('[Email] Queue initialized with Redis');
  } catch {
    console.warn('[Email] Redis not available, email queue disabled');
  }
} else {
  console.log('[Email] Redis not configured, emails will be sent directly');
}

/**
 * Preferred entry point for anything triggered by a notification: it resolves the
 * recipient's address and drops the mail if they turned email or that type off.
 */
export async function enqueueEmailToUser(
  userId: string,
  type: NotificationType,
  mail: { subject: string; html: string },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notificationPrefs: { select: { emailEnabled: true } } },
  });
  if (!user) return;
  if (user.notificationPrefs && !user.notificationPrefs.emailEnabled) return;
  if (!(await wantsNotification(userId, type))) return;
  await enqueueEmail({ to: user.email, ...mail });
}

export async function enqueueEmail(data: EmailJobData): Promise<void> {
  if (emailQueue) {
    await emailQueue.add(data);
  } else {
    try { await sendMail(data); } catch { /* silent */ }
  }
}
