import { NotificationType } from '@prisma/client';
import prisma from '../../config/db';
import { saveFile, removeFile } from '../../config/storage';
import { enqueueNotification } from '../../jobs/notificationQueue';

const fileSelect = {
  id: true, filename: true, originalName: true, mimeType: true, size: true, url: true,
  taskId: true, projectId: true, commentId: true, createdAt: true,
  uploader: { select: { id: true, displayName: true, avatarUrl: true } },
};

export async function attachToTask(
  taskId: string,
  uploaderId: string,
  files: Express.Multer.File[],
  commentId?: string,
) {
  if (!files.length) throw Object.assign(new Error('No file uploaded'), { status: 400 });
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, projectId: true, assigneeId: true },
  });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });

  // Bytes go to storage first: a failed upload must not leave a File row pointing at nothing.
  // The reverse leak (blob saved, transaction rolled back) only wastes space, so it is the safe side.
  const stored = await Promise.all(files.map((f) => saveFile(f)));

  const created = await prisma.$transaction(
    files.map((f, i) =>
      prisma.file.create({
        data: {
          uploaderId, taskId, projectId: task.projectId, commentId,
          filename: stored[i].filename,
          originalName: f.originalname,
          mimeType: f.mimetype,
          size: f.size,
          storageKey: stored[i].storageKey,
          url: stored[i].url,
        },
        select: fileSelect,
      }),
    ),
  );

  if (task.assigneeId && task.assigneeId !== uploaderId) {
    await enqueueNotification({
      recipientId: task.assigneeId, type: NotificationType.FILE_UPLOADED, taskId: task.id,
      message: `${created.length} file(s) attached to "${task.title}"`,
    });
  }
  return created;
}

export async function listByTask(taskId: string) {
  return prisma.file.findMany({ where: { taskId }, select: fileSelect, orderBy: { createdAt: 'desc' } });
}

export async function listByProject(projectId: string) {
  return prisma.file.findMany({ where: { projectId }, select: fileSelect, orderBy: { createdAt: 'desc' } });
}

export async function remove(fileId: string, userId: string, isProjectManager: boolean) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    select: { id: true, uploaderId: true, storageKey: true, mimeType: true },
  });
  if (!file) throw Object.assign(new Error('File not found'), { status: 404 });
  if (file.uploaderId !== userId && !isProjectManager) {
    throw Object.assign(new Error('You can only delete files you uploaded'), { status: 403 });
  }
  await prisma.file.delete({ where: { id: fileId } });
  await removeFile(file.storageKey, file.mimeType);
}

export async function getProjectIdOf(fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId }, select: { projectId: true } });
  if (!file?.projectId) throw Object.assign(new Error('File not found'), { status: 404 });
  return file.projectId;
}
