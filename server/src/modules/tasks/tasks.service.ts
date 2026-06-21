import prisma from '../../config/db';
import { CreateTaskInput, UpdateTaskInput, MoveTaskInput } from './tasks.schema';

const taskSelect = {
  id: true, projectId: true, columnId: true, parentId: true,
  title: true, description: true, status: true, priority: true,
  assigneeId: true, creatorId: true, order: true,
  startDate: true, dueDate: true, completedAt: true, estimatedHrs: true,
  createdAt: true, updatedAt: true,
  assignee: { select: { id: true, displayName: true, avatarUrl: true } },
  creator: { select: { id: true, displayName: true, avatarUrl: true } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, subtasks: true, timeLogs: true } },
};

export async function listByProject(projectId: string, filters: { status?: string; assigneeId?: string; priority?: string; search?: string }) {
  return prisma.task.findMany({
    where: {
      projectId,
      parentId: null,
      ...(filters.status && { status: filters.status as never }),
      ...(filters.assigneeId && { assigneeId: filters.assigneeId }),
      ...(filters.priority && { priority: filters.priority as never }),
      ...(filters.search && { title: { contains: filters.search, mode: 'insensitive' } }),
    },
    select: taskSelect,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createTask(projectId: string, creatorId: string, input: CreateTaskInput) {
  const last = await prisma.task.findFirst({
    where: { projectId, columnId: input.columnId ?? null },
    orderBy: { order: 'desc' },
  });
  const order = input.order ?? (last ? last.order + 1 : 0);
  return prisma.task.create({
    data: {
      projectId,
      creatorId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      assigneeId: input.assigneeId,
      columnId: input.columnId,
      parentId: input.parentId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      estimatedHrs: input.estimatedHrs,
      order,
    },
    select: taskSelect,
  });
}

export async function getTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      ...taskSelect,
      subtasks: { select: taskSelect },
    },
  });
  if (!task) throw Object.assign(new Error('Task not found'), { status: 404 });
  return task;
}

export async function updateTask(taskId: string, input: UpdateTaskInput) {
  const data: Record<string, unknown> = { ...input };
  if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.status === 'DONE') data.completedAt = new Date();
  else if (input.status) data.completedAt = null;
  return prisma.task.update({ where: { id: taskId }, data, select: taskSelect });
}

export async function deleteTask(taskId: string) {
  await prisma.task.delete({ where: { id: taskId } });
}

export async function moveTask(taskId: string, input: MoveTaskInput) {
  return prisma.task.update({
    where: { id: taskId },
    data: { columnId: input.columnId, order: input.order },
    select: taskSelect,
  });
}

export async function getSubtasks(taskId: string) {
  return prisma.task.findMany({ where: { parentId: taskId }, select: taskSelect, orderBy: { order: 'asc' } });
}

export async function verifyTaskBelongsToProject(taskId: string, projectId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) throw Object.assign(new Error('Task not found in this project'), { status: 404 });
  return task;
}
