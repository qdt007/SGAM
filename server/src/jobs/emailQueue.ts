import Bull from 'bull';
import { sendMail } from '../config/mailer';
export interface EmailJobData { to: string; subject: string; html: string; }
export const emailQueue = new Bull<EmailJobData>('email', {
  redis: { host: process.env.REDIS_HOST || 'localhost', port: parseInt(process.env.REDIS_PORT || '6379') },
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100 },
});
emailQueue.process(async (job) => { await sendMail(job.data); console.log(`[Email] Sent to ${job.data.to}`); });
emailQueue.on('failed', (job, err) => console.error(`[Email] Job ${job.id} failed:`, err.message));
export async function enqueueEmail(data: EmailJobData): Promise<void> { await emailQueue.add(data); }
