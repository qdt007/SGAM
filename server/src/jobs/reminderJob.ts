import cron from 'node-cron';
import prisma from '../config/db';
import { enqueueNotification } from './notificationQueue';
import { enqueueEmail } from './emailQueue';
import { NotificationType } from '@prisma/client';
export function startReminderJob(): void {
  cron.schedule('0 8 * * *', async () => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(dayAfter.getDate() + 1);
    try {
      const tasks = await prisma.task.findMany({
        where: { dueDate: { gte: tomorrow, lt: dayAfter }, status: { notIn: ['DONE','CANCELLED'] }, assigneeId: { not: null } },
        include: { assignee: { select: { id: true, email: true, displayName: true } }, project: { select: { name: true } } },
      });
      for (const task of tasks) {
        if (!task.assignee) continue;
        await enqueueNotification({ recipientId: task.assignee.id, type: NotificationType.DEADLINE_APPROACHING, taskId: task.id, message: `Task "${task.title}" in ${task.project.name} is due tomorrow.` });
        await enqueueEmail({ to: task.assignee.email, subject: `Deadline: "${task.title}"`, html: `<p>Your task <b>${task.title}</b> is due tomorrow.</p>` });
      }
      console.log(`[ReminderJob] Sent ${tasks.length} reminders`);
    } catch (err) { console.error('[ReminderJob]', err); }
  });
  console.log('[ReminderJob] Scheduled daily 08:00');
}
