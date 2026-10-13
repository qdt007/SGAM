import { BlockerImpact, BlockerStatus, NotificationType } from '@prisma/client';
import prisma from '../../config/db';
import { emitToProject } from '../../config/socket';
import { SOCKET_EVENTS } from '../../constants/events';
import { enqueueNotification, fanoutNotification } from '../../jobs/notificationQueue';
import { enqueueEmailToUser } from '../../jobs/emailQueue';
import { CreateBlockerInput, UpdateBlockerInput, ResolveBlockerInput } from './blockers.schema';

/**
 * Difficulties the project is actually stuck on.
 *
 * Not tasks, and deliberately not stored as tasks: a task is work somebody owns and finishes,
 * while a blocker is an obstacle in front of the work — it gets resolved, often by someone who
 * was never assigned it, and sometimes by a decision rather than by effort. Putting these in the
 * task table would make every count on the board and in the reports wrong.
 */

const blockerSelect = {
  id: true,
  projectId: true,
  taskId: true,
  title: true,
  description: true,
  impact: true,
  status: true,
  resolution: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  raisedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  resolvedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  task: { select: { id: true, title: true, status: true } },
};

/** Worst first, then newest — the order someone scanning for what to deal with wants. */
const IMPACT_ORDER: Record<BlockerImpact, number> = { BLOCKING: 0, SERIOUS: 1, MINOR: 2 };

export async function list(projectId: string, status?: BlockerStatus) {
  const blockers = await prisma.blocker.findMany({
    where: { projectId, ...(status && { status }) },
    select: blockerSelect,
    orderBy: { createdAt: 'desc' },
  });

  // Open ones are sorted by how much they hurt; resolved ones stay newest-first, because once
  // something is fixed its severity stops being how you look for it.
  const open = blockers
    .filter((b) => b.status === 'OPEN')
    .sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]);
  const resolved = blockers.filter((b) => b.status === 'RESOLVED');

  return {
    blockers: status ? blockers : [...open, ...resolved],
    counts: {
      open: open.length,
      resolved: resolved.length,
      blocking: open.filter((b) => b.impact === 'BLOCKING').length,
    },
  };
}

export async function get(blockerId: string) {
  const blocker = await prisma.blocker.findUnique({ where: { id: blockerId }, select: blockerSelect });
  if (!blocker) throw Object.assign(new Error('Blocker not found'), { status: 404 });
  return blocker;
}

export async function create(projectId: string, raisedById: string, input: CreateBlockerInput) {
  if (input.taskId) await assertTaskInProject(input.taskId, projectId);

  const blocker = await prisma.blocker.create({
    data: {
      projectId,
      raisedById,
      title: input.title,
      description: input.description,
      impact: input.impact ?? BlockerImpact.SERIOUS,
      taskId: input.taskId ?? null,
    },
    select: blockerSelect,
  });

  emitToProject(projectId, SOCKET_EVENTS.BLOCKER_CREATED, blocker);

  // The whole project hears about a blocker. That is the point of recording one — a difficulty
  // only the person who hit it knows about is the thing this feature exists to prevent.
  const projectName = await projectNameOf(projectId);
  const raiser = blocker.raisedBy.displayName;
  const recipients = await otherMemberIds(projectId, raisedById);

  // Parallel, not a loop of awaits: with no Redis these run inline, and emailing a six-person
  // project one at a time would hold the response open for an SMTP round trip each.
  await Promise.all([
    fanoutNotification(recipients, {
      type: NotificationType.BLOCKER_RAISED,
      projectId,
      taskId: blocker.taskId ?? undefined,
      message: `${raiser} đã nêu một khó khăn trong ${projectName}: "${blocker.title}"`,
    }),
    // Only a BLOCKING one is worth an email. Everything else waits for them to open the app.
    ...(blocker.impact === BlockerImpact.BLOCKING
      ? recipients.map((recipientId) =>
          enqueueEmailToUser(recipientId, NotificationType.BLOCKER_RAISED, {
            subject: `[${projectName}] Khó khăn đang chặn tiến độ`,
            html: `<p><b>${raiser}</b> đã nêu một khó khăn đang <b>chặn tiến độ</b> của ${escapeHtml(projectName)}:</p>
                   <p><b>${escapeHtml(blocker.title)}</b></p>
                   ${blocker.description ? `<p>${escapeHtml(blocker.description)}</p>` : ''}`,
          }),
        )
      : []),
  ]);

  return blocker;
}

export async function update(blockerId: string, input: UpdateBlockerInput) {
  const existing = await prisma.blocker.findUnique({
    where: { id: blockerId },
    select: { projectId: true, status: true },
  });
  if (!existing) throw Object.assign(new Error('Blocker not found'), { status: 404 });
  if (input.taskId) await assertTaskInProject(input.taskId, existing.projectId);

  const blocker = await prisma.blocker.update({ where: { id: blockerId }, data: input, select: blockerSelect });
  emitToProject(existing.projectId, SOCKET_EVENTS.BLOCKER_UPDATED, blocker);
  return blocker;
}

/** Closes it and records what was done, which is the part worth having next time. */
export async function resolve(blockerId: string, resolvedById: string, input: ResolveBlockerInput) {
  const existing = await prisma.blocker.findUnique({
    where: { id: blockerId },
    select: { projectId: true, status: true, title: true, raisedById: true },
  });
  if (!existing) throw Object.assign(new Error('Blocker not found'), { status: 404 });
  if (existing.status === BlockerStatus.RESOLVED) {
    throw Object.assign(new Error('This difficulty is already resolved'), { status: 409 });
  }

  const blocker = await prisma.blocker.update({
    where: { id: blockerId },
    data: {
      status: BlockerStatus.RESOLVED,
      resolution: input.resolution,
      resolvedById,
      resolvedAt: new Date(),
    },
    select: blockerSelect,
  });

  emitToProject(existing.projectId, SOCKET_EVENTS.BLOCKER_UPDATED, blocker);

  // Only the person who raised it is told, and only if someone else resolved it. Everyone else
  // already saw it appear; being told twice about something that is now fine is noise.
  if (existing.raisedById !== resolvedById) {
    await enqueueNotification({
      recipientId: existing.raisedById,
      type: NotificationType.BLOCKER_RAISED,
      projectId: existing.projectId,
      message: `${blocker.resolvedBy?.displayName ?? 'Ai đó'} đã xử lý khó khăn "${existing.title}"`,
    });
  }

  return blocker;
}

/** Puts it back on the list when the fix did not hold. */
export async function reopen(blockerId: string) {
  const existing = await prisma.blocker.findUnique({ where: { id: blockerId }, select: { projectId: true, status: true } });
  if (!existing) throw Object.assign(new Error('Blocker not found'), { status: 404 });
  if (existing.status === BlockerStatus.OPEN) {
    throw Object.assign(new Error('This difficulty is already open'), { status: 409 });
  }

  const blocker = await prisma.blocker.update({
    where: { id: blockerId },
    data: { status: BlockerStatus.OPEN, resolution: null, resolvedById: null, resolvedAt: null },
    select: blockerSelect,
  });
  emitToProject(existing.projectId, SOCKET_EVENTS.BLOCKER_UPDATED, blocker);
  return blocker;
}

export async function remove(blockerId: string) {
  const existing = await prisma.blocker.findUnique({ where: { id: blockerId }, select: { projectId: true } });
  if (!existing) throw Object.assign(new Error('Blocker not found'), { status: 404 });

  await prisma.blocker.delete({ where: { id: blockerId } });
  emitToProject(existing.projectId, SOCKET_EVENTS.BLOCKER_DELETED, { id: blockerId, projectId: existing.projectId });
  return { id: blockerId };
}

/** A blocker may only point at a task in its own project, or it would leak the task's title. */
async function assertTaskInProject(taskId: string, projectId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task || task.projectId !== projectId) {
    throw Object.assign(new Error('That task is not in this project'), { status: 400 });
  }
}

async function otherMemberIds(projectId: string, exceptId: string): Promise<string[]> {
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { not: exceptId } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

async function projectNameOf(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  return project?.name ?? 'dự án';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
