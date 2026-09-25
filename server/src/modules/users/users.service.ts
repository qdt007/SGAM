import prisma from '../../config/db';
import { saveFile, removeFile, UploadInput } from '../../config/storage';
import { hashPassword, comparePassword } from '../../utils/hash';
import { UpdateMeInput, ChangePasswordInput, UpdateNotificationPrefsInput } from './users.schema';

const publicSelect = { id: true, email: true, username: true, displayName: true, avatarUrl: true, globalRole: true, createdAt: true };

/** Directory search used by the member picker and the @mention autocomplete. */
export async function search(query: string, projectId: string | undefined, limit: number) {
  const q = query.trim();
  return prisma.user.findMany({
    where: {
      isActive: true,
      ...(q && {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { username: { contains: q, mode: 'insensitive' as const } },
          { displayName: { contains: q, mode: 'insensitive' as const } },
        ],
      }),
      ...(projectId && { projectMemberships: { some: { projectId } } }),
    },
    select: { id: true, username: true, displayName: true, avatarUrl: true, email: true },
    orderBy: { displayName: 'asc' },
    take: limit,
  });
}

export async function getById(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicSelect });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

export async function updateMe(userId: string, input: UpdateMeInput) {
  if (input.username) {
    const taken = await prisma.user.findFirst({ where: { username: input.username, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw Object.assign(new Error('This username is already taken'), { status: 409 });
  }
  // Pointing avatarUrl at an external image abandons any blob we uploaded, so drop it here
  // rather than leaving a key that no longer describes what avatarUrl serves.
  const replacingAvatar = input.avatarUrl !== undefined;
  const previous = replacingAvatar
    ? await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } })
    : null;

  const user = await prisma.user.update({
    where: { id: userId },
    data: replacingAvatar ? { ...input, avatarKey: null } : input,
    select: publicSelect,
  });
  if (previous?.avatarKey) await removeFile(previous.avatarKey, AVATAR_DELETE_MIME);
  return user;
}

// Every mime uploadAvatar accepts (png/jpeg/webp/gif) maps to the same Cloudinary resource_type,
// so one representative is enough to delete any of them, and the local backend ignores it.
const AVATAR_DELETE_MIME = 'image/png';

/** Replaces the avatar with an uploaded image and cleans up the blob it replaced. */
export async function setAvatar(userId: string, file: UploadInput) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  if (!current) throw Object.assign(new Error('User not found'), { status: 404 });

  const stored = await saveFile(file);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: stored.url, avatarKey: stored.storageKey },
    select: publicSelect,
  });
  // Only once the new avatar is committed: a failed cleanup must never cost the user the new one.
  if (current.avatarKey) await removeFile(current.avatarKey, AVATAR_DELETE_MIME);
  return user;
}

/** Clears the avatar and deletes the stored image, falling the UI back to initials. */
export async function removeAvatar(userId: string) {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
  if (!current) throw Object.assign(new Error('User not found'), { status: 404 });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null, avatarKey: null },
    select: publicSelect,
  });
  if (current.avatarKey) await removeFile(current.avatarKey, AVATAR_DELETE_MIME);
  return user;
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  if (!(await comparePassword(input.currentPassword, user.passwordHash))) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 400 });
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
  // Force re-login everywhere else: every outstanding refresh token dies with the old password.
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

/** Preferences are created lazily, so a user who never opened Settings still gets the defaults. */
export async function getNotificationPrefs(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function updateNotificationPrefs(userId: string, input: UpdateNotificationPrefsInput) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
}

/** Cross-project stats for the dashboard / workload report. */
export async function getMyStats(userId: string) {
  const [projects, assigned, done, overdue] = await Promise.all([
    prisma.projectMember.count({ where: { userId } }),
    prisma.task.count({ where: { assigneeId: userId, status: { notIn: ['DONE', 'CANCELLED'] } } }),
    prisma.task.count({ where: { assigneeId: userId, status: 'DONE' } }),
    prisma.task.count({ where: { assigneeId: userId, status: { notIn: ['DONE', 'CANCELLED'] }, dueDate: { lt: new Date() } } }),
  ]);
  return { projects, assigned, done, overdue };
}
