import { NotificationType } from '@prisma/client';
import prisma from '../../config/db';
import { emitToProject } from '../../config/socket';
import { SOCKET_EVENTS } from '../../constants/events';
import { enqueueNotification } from '../../jobs/notificationQueue';
import { enqueueEmailToUser } from '../../jobs/emailQueue';
import { extractMentions, resolveUserIds } from '../../utils/mentions';
import { CreateCommentInput, UpdateCommentInput } from './comments.schema';

const commentSelect = {
  id: true, body: true, taskId: true, projectId: true, authorId: true,
  editedAt: true, createdAt: true, updatedAt: true,
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  mentions: { select: { mentionedId: true, mentioned: { select: { id: true, username: true, displayName: true } } } },
  files: { select: { id: true, originalName: true, url: true, mimeType: true, size: true } },
};

export async function listByTask(taskId: string) {
  return prisma.comment.findMany({ where: { taskId }, select: commentSelect, orderBy: { createdAt: 'asc' } });
}

export async function create(taskId: string, authorId: string, input: CreateCommentInput) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, projectId: true, assigneeId: true, project: { select: { name: true } } },
  });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

  // @handles only become mentions if they belong to a member of this project.
  const handles = extractMentions(input.body);
  const candidateIds = await resolveUserIds(handles, prisma);
  const mentionedIds = candidateIds.length
    ? (await prisma.projectMember.findMany({
        where: { projectId: task.projectId, userId: { in: candidateIds } },
        select: { userId: true },
      })).map((m) => m.userId).filter((id) => id !== authorId)
    : [];

  const comment = await prisma.comment.create({
    data: {
      body: input.body,
      taskId,
      projectId: task.projectId,
      authorId,
      ...(mentionedIds.length && { mentions: { create: mentionedIds.map((mentionedId) => ({ mentionedId })) } }),
    },
    select: commentSelect,
  });

  emitToProject(task.projectId, SOCKET_EVENTS.COMMENT_CREATED, comment);
  await notifyComment(comment.author.displayName, task, authorId, mentionedIds);
  return comment;
}

async function notifyComment(
  authorName: string,
  task: { id: string; title: string; assigneeId: string | null; project: { name: string } },
  authorId: string,
  mentionedIds: string[],
) {
  for (const recipientId of mentionedIds) {
    await enqueueNotification({
      recipientId, type: NotificationType.MENTIONED, taskId: task.id,
      message: `${authorName} mentioned you on "${task.title}"`,
    });
  }
  // The assignee hears about the comment too, unless they wrote it or were already mentioned.
  if (task.assigneeId && task.assigneeId !== authorId && !mentionedIds.includes(task.assigneeId)) {
    await enqueueNotification({
      recipientId: task.assigneeId, type: NotificationType.TASK_COMMENTED, taskId: task.id,
      message: `${authorName} commented on "${task.title}"`,
    });
  }
  for (const recipientId of mentionedIds) {
    await enqueueEmailToUser(recipientId, NotificationType.MENTIONED, {
      subject: `${authorName} mentioned you on "${task.title}"`,
      html: `<p><b>${authorName}</b> mentioned you on <b>${task.title}</b> in ${task.project.name}.</p>`,
    });
  }
}

export async function update(commentId: string, userId: string, input: UpdateCommentInput) {
  const existing = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true, projectId: true } });
  if (!existing) throw Object.assign(new Error('Comment not found'), { status: 404 });
  if (existing.authorId !== userId) throw Object.assign(new Error('You can only edit your own comments'), { status: 403 });

  const handles = extractMentions(input.body);
  const mentionedIds = (await resolveUserIds(handles, prisma)).filter((id) => id !== userId);

  const comment = await prisma.$transaction(async (tx) => {
    await tx.mention.deleteMany({ where: { commentId } });
    return tx.comment.update({
      where: { id: commentId },
      data: {
        body: input.body,
        editedAt: new Date(),
        ...(mentionedIds.length && { mentions: { create: mentionedIds.map((mentionedId) => ({ mentionedId })) } }),
      },
      select: commentSelect,
    });
  });
  if (existing.projectId) emitToProject(existing.projectId, SOCKET_EVENTS.COMMENT_CREATED, comment);
  return comment;
}

export async function remove(commentId: string, userId: string, isProjectManager: boolean) {
  const existing = await prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true, projectId: true } });
  if (!existing) throw Object.assign(new Error('Comment not found'), { status: 404 });
  if (existing.authorId !== userId && !isProjectManager) {
    throw Object.assign(new Error('You can only delete your own comments'), { status: 403 });
  }
  await prisma.comment.delete({ where: { id: commentId } });
  return existing.projectId;
}
