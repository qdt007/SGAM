import { NotificationType } from '@prisma/client';
import prisma from '../../config/db';
import { emitToProject } from '../../config/socket';
import { SOCKET_EVENTS } from '../../constants/events';
import { enqueueNotification, fanoutNotification } from '../../jobs/notificationQueue';
import { enqueueEmailToUser } from '../../jobs/emailQueue';
import { extractMentions, resolveUserIds } from '../../utils/mentions';
import { CreateMessageInput, UpdateMessageInput } from './messages.schema';

/**
 * Project chat.
 *
 * Kept apart from `comments` because the two are not the same thing: a comment hangs off a task
 * and is part of that task's record, while this is conversation about the project as a whole.
 * Pinning a message turns it into the announcement everyone gets notified about.
 */

const messageSelect = {
  id: true,
  body: true,
  pinned: true,
  projectId: true,
  authorId: true,
  editedAt: true,
  createdAt: true,
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  mentions: { select: { mentionedId: true, mentioned: { select: { id: true, username: true, displayName: true } } } },
};

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/**
 * One page of history, newest first so `before` can walk backwards, then reversed so the caller
 * gets it in reading order. A chat that loaded oldest-first would have to count every row in the
 * project before it could show the latest one.
 */
export async function list(projectId: string, opts: { before?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(opts.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  // `before` is a message id rather than a timestamp: two messages can share a millisecond, and
  // an id cursor cannot skip or repeat one the way a timestamp cursor can.
  const cursor = opts.before
    ? await prisma.message.findUnique({ where: { id: opts.before }, select: { createdAt: true, projectId: true } })
    : null;
  if (opts.before && (!cursor || cursor.projectId !== projectId)) {
    throw Object.assign(new Error('Message not found in this project'), { status: 404 });
  }

  const page = await prisma.message.findMany({
    where: { projectId, ...(cursor && { createdAt: { lt: cursor.createdAt } }) },
    select: messageSelect,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = page.length > limit;
  return { messages: page.slice(0, limit).reverse(), hasMore };
}

/** Pinned messages, newest first — the project's standing announcements. */
export async function listPinned(projectId: string) {
  return prisma.message.findMany({
    where: { projectId, pinned: true },
    select: messageSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function create(projectId: string, authorId: string, input: CreateMessageInput) {
  const mentionedIds = await resolveProjectMentions(projectId, input.body, authorId);

  const message = await prisma.message.create({
    data: {
      projectId,
      authorId,
      body: input.body,
      pinned: input.pinned ?? false,
      ...(mentionedIds.length && { mentions: { create: mentionedIds.map((mentionedId) => ({ mentionedId })) } }),
    },
    select: messageSelect,
  });

  emitToProject(projectId, SOCKET_EVENTS.MESSAGE_CREATED, message);
  await notifyMessage(message, mentionedIds);
  return message;
}

export async function update(messageId: string, userId: string, input: UpdateMessageInput) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, projectId: true, pinned: true },
  });
  if (!existing) throw Object.assign(new Error('Message not found'), { status: 404 });

  // Editing the words is the author's alone; pinning is a project decision, so a manager can
  // pin someone else's message without being able to rewrite it.
  const editing = input.body !== undefined;
  if (editing && existing.authorId !== userId) {
    throw Object.assign(new Error('You can only edit your own messages'), { status: 403 });
  }

  const message = await prisma.$transaction(async (tx) => {
    if (editing) await tx.messageMention.deleteMany({ where: { messageId } });
    const mentionedIds = editing ? await resolveProjectMentions(existing.projectId, input.body!, userId, tx) : [];
    return tx.message.update({
      where: { id: messageId },
      data: {
        ...(editing && { body: input.body, editedAt: new Date() }),
        ...(input.pinned !== undefined && { pinned: input.pinned }),
        ...(mentionedIds.length && { mentions: { create: mentionedIds.map((mentionedId) => ({ mentionedId })) } }),
      },
      select: messageSelect,
    });
  });

  emitToProject(existing.projectId, SOCKET_EVENTS.MESSAGE_UPDATED, message);

  // Pinning an existing message announces it, exactly as posting it pinned would have.
  if (input.pinned === true && !existing.pinned) await announce(message);
  return message;
}

export async function remove(messageId: string, userId: string, canModerate: boolean) {
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, projectId: true },
  });
  if (!existing) throw Object.assign(new Error('Message not found'), { status: 404 });
  if (existing.authorId !== userId && !canModerate) {
    throw Object.assign(new Error('You can only delete your own messages'), { status: 403 });
  }

  await prisma.message.delete({ where: { id: messageId } });
  emitToProject(existing.projectId, SOCKET_EVENTS.MESSAGE_DELETED, { id: messageId, projectId: existing.projectId });
  return { id: messageId };
}

/** @handles only become mentions for members of this project — the same rule comments follow. */
async function resolveProjectMentions(
  projectId: string,
  body: string,
  authorId: string,
  tx: { projectMember: { findMany: typeof prisma.projectMember.findMany } } = prisma,
): Promise<string[]> {
  const handles = extractMentions(body);
  if (!handles.length) return [];
  const candidateIds = await resolveUserIds(handles, prisma);
  if (!candidateIds.length) return [];
  const members = await tx.projectMember.findMany({
    where: { projectId, userId: { in: candidateIds } },
    select: { userId: true },
  });
  return members.map((m) => m.userId).filter((id) => id !== authorId);
}

type StoredMessage = Awaited<ReturnType<typeof create>>;

/** Everyone in the project except one person — who is almost always whoever just wrote. */
async function otherMemberIds(projectId: string, exceptId: string): Promise<string[]> {
  const members = await prisma.projectMember.findMany({
    where: { projectId, userId: { not: exceptId } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

/**
 * Three audiences, narrowest first, and nobody hears about one message twice.
 *
 * A mention is addressed at someone, so it always notifies. A pinned message is addressed at the
 * project, so it notifies everyone. An ordinary message notifies the rest of the project through
 * CHAT_MESSAGE, which `NotificationPreference.chatMessage` has switched off by default — without
 * that, an active chat would bury every other notification a person has.
 */
async function notifyMessage(message: StoredMessage, mentionedIds: string[]) {
  const projectName = await projectNameOf(message.projectId);
  const author = message.author.displayName;

  // Fanned out in parallel, not in a loop of awaits. Without Redis these send inline, and a
  // sequential loop makes posting one message cost one SMTP round trip per recipient.
  await Promise.all([
    fanoutNotification(mentionedIds, {
      type: NotificationType.MENTIONED,
      projectId: message.projectId,
      message: `${author} đã nhắc bạn trong chat của ${projectName}`,
    }),
    ...mentionedIds.map((recipientId) =>
      enqueueEmailToUser(recipientId, NotificationType.MENTIONED, {
        subject: `${author} đã nhắc bạn trong ${projectName}`,
        html: `<p><b>${author}</b> đã nhắc bạn trong chat của <b>${projectName}</b>:</p><blockquote>${escapeHtml(message.body)}</blockquote>`,
      }),
    ),
  ]);

  if (message.pinned) {
    await announce(message, mentionedIds);
    return;
  }

  const rest = (await otherMemberIds(message.projectId, message.authorId)).filter((id) => !mentionedIds.includes(id));
  await fanoutNotification(rest, {
    type: NotificationType.CHAT_MESSAGE,
    projectId: message.projectId,
    message: `${author} đã gửi tin nhắn trong ${projectName}`,
  });
}

/** A pinned message reaches the whole project, by notification and by email. */
async function announce(message: StoredMessage, alreadyNotified: string[] = []) {
  const projectName = await projectNameOf(message.projectId);
  const author = message.author.displayName;
  const recipients = (await otherMemberIds(message.projectId, message.authorId)).filter(
    (id) => !alreadyNotified.includes(id),
  );

  await Promise.all([
    fanoutNotification(recipients, {
      type: NotificationType.ANNOUNCEMENT,
      projectId: message.projectId,
      message: `Thông báo quan trọng từ ${author} trong ${projectName}`,
    }),
    ...recipients.map((recipientId) =>
      enqueueEmailToUser(recipientId, NotificationType.ANNOUNCEMENT, {
        subject: `[${projectName}] Thông báo quan trọng`,
        html: `<p><b>${author}</b> đã ghim một thông báo trong <b>${projectName}</b>:</p><blockquote>${escapeHtml(message.body)}</blockquote>`,
      }),
    ),
  ]);
}

async function projectNameOf(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  return project?.name ?? 'dự án';
}

/** Message bodies are user input and these end up in an email body. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
