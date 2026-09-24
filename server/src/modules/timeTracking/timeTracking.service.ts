import prisma from '../../config/db';
import { emitToUser } from '../../config/socket';
import { SOCKET_EVENTS } from '../../constants/events';
import { StopTimerInput, LogManualInput, UpdateTimeLogInput } from './timeTracking.schema';

const logSelect = {
  id: true, taskId: true, userId: true, startedAt: true, endedAt: true, durationMin: true, note: true, createdAt: true,
  user: { select: { id: true, displayName: true, avatarUrl: true } },
  task: { select: { id: true, title: true, projectId: true } },
};

const minutesBetween = (start: Date, end: Date) => Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));

/** A user may only have one timer running at a time, across every project. */
export async function getRunning(userId: string) {
  return prisma.timeLog.findFirst({ where: { userId, endedAt: null }, select: logSelect, orderBy: { startedAt: 'desc' } });
}

export async function startTimer(taskId: string, userId: string) {
  const running = await getRunning(userId);
  if (running) {
    if (running.taskId === taskId) return running;
    // Switching tasks closes the previous timer rather than silently losing it.
    await stopRunning(running.id, running.startedAt);
    emitToUser(userId, SOCKET_EVENTS.TIMER_CONFLICT, { stoppedTimeLogId: running.id, taskId: running.taskId });
  }
  return prisma.timeLog.create({ data: { taskId, userId, startedAt: new Date() }, select: logSelect });
}

async function stopRunning(id: string, startedAt: Date) {
  const endedAt = new Date();
  return prisma.timeLog.update({
    where: { id },
    data: { endedAt, durationMin: minutesBetween(startedAt, endedAt) },
    select: logSelect,
  });
}

export async function stopTimer(taskId: string, userId: string, input: StopTimerInput) {
  const log = input.timeLogId
    ? await prisma.timeLog.findFirst({ where: { id: input.timeLogId, userId, endedAt: null }, select: { id: true, startedAt: true } })
    : await prisma.timeLog.findFirst({ where: { taskId, userId, endedAt: null }, orderBy: { startedAt: 'desc' }, select: { id: true, startedAt: true } });
  if (!log) throw Object.assign(new Error('No running timer found for this task'), { status: 404 });
  const endedAt = new Date();
  return prisma.timeLog.update({
    where: { id: log.id },
    data: { endedAt, durationMin: minutesBetween(log.startedAt, endedAt), ...(input.note && { note: input.note }) },
    select: logSelect,
  });
}

export async function logManual(taskId: string, userId: string, input: LogManualInput) {
  const startedAt = new Date(input.startedAt);
  const endedAt = new Date(input.endedAt);
  return prisma.timeLog.create({
    data: { taskId, userId, startedAt, endedAt, durationMin: minutesBetween(startedAt, endedAt), note: input.note },
    select: logSelect,
  });
}

export async function listByTask(taskId: string) {
  return prisma.timeLog.findMany({ where: { taskId }, select: logSelect, orderBy: { startedAt: 'desc' } });
}

export async function update(id: string, userId: string, input: UpdateTimeLogInput) {
  const existing = await prisma.timeLog.findUnique({ where: { id }, select: { userId: true, startedAt: true, endedAt: true } });
  if (!existing) throw Object.assign(new Error('Time log not found'), { status: 404 });
  if (existing.userId !== userId) throw Object.assign(new Error('You can only edit your own time logs'), { status: 403 });

  const startedAt = input.startedAt ? new Date(input.startedAt) : existing.startedAt;
  const endedAt = input.endedAt ? new Date(input.endedAt) : existing.endedAt;
  if (endedAt && endedAt <= startedAt) throw Object.assign(new Error('endedAt must be after startedAt'), { status: 422 });

  return prisma.timeLog.update({
    where: { id },
    data: {
      startedAt, endedAt,
      durationMin: endedAt ? minutesBetween(startedAt, endedAt) : null,
      ...(input.note !== undefined && { note: input.note }),
    },
    select: logSelect,
  });
}

export async function remove(id: string, userId: string) {
  const existing = await prisma.timeLog.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) throw Object.assign(new Error('Time log not found'), { status: 404 });
  if (existing.userId !== userId) throw Object.assign(new Error('You can only delete your own time logs'), { status: 403 });
  await prisma.timeLog.delete({ where: { id } });
}
