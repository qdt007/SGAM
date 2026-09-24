import { NotificationType } from '@prisma/client';
import prisma from '../../config/db';
import { emitToProject } from '../../config/socket';
import { SOCKET_EVENTS } from '../../constants/events';
import { enqueueNotification } from '../../jobs/notificationQueue';
import { enqueueEmailToUser } from '../../jobs/emailQueue';
import { detectCycles } from '../../utils/ganttHelpers';
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

export async function listByProject(projectId: string, userId: string, filters: { status?: string; assigneeId?: string; priority?: string; search?: string }) {
  // Verify user is a member of the project
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!member) throw Object.assign(new Error('Project not found'), { status: 404 });

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
  const task = await prisma.task.create({
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
  emitToProject(projectId, SOCKET_EVENTS.TASK_CREATED, task);
  if (task.assigneeId && task.assigneeId !== creatorId) await notifyAssignee(task.id, task.assigneeId, task.title);
  return task;
}

/** Fired whenever a task lands on someone who did not put it there themselves. */
async function notifyAssignee(taskId: string, assigneeId: string, title: string) {
  await enqueueNotification({
    recipientId: assigneeId, type: NotificationType.TASK_ASSIGNED, taskId,
    message: `You were assigned to "${title}"`,
  });
  await enqueueEmailToUser(assigneeId, NotificationType.TASK_ASSIGNED, {
    subject: `You were assigned to "${title}"`,
    html: `<p>You have been assigned to <b>${title}</b>.</p>`,
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

export async function updateTask(taskId: string, input: UpdateTaskInput, actorId?: string) {
  const before = await prisma.task.findUnique({ where: { id: taskId }, select: { assigneeId: true } });
  const data: Record<string, unknown> = { ...input };
  if (input.startDate !== undefined) data.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.status === 'DONE') data.completedAt = new Date();
  else if (input.status) data.completedAt = null;
  const task = await prisma.task.update({ where: { id: taskId }, data, select: taskSelect });
  emitToProject(task.projectId, SOCKET_EVENTS.TASK_UPDATED, task);
  if (task.assigneeId && task.assigneeId !== before?.assigneeId && task.assigneeId !== actorId) {
    await notifyAssignee(task.id, task.assigneeId, task.title);
  }
  return task;
}

export async function deleteTask(taskId: string) {
  const task = await prisma.task.delete({ where: { id: taskId }, select: { id: true, projectId: true } });
  emitToProject(task.projectId, SOCKET_EVENTS.TASK_DELETED, { id: task.id, projectId: task.projectId });
}

export async function moveTask(taskId: string, input: MoveTaskInput) {
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { columnId: input.columnId, order: input.order },
    select: taskSelect,
  });
  emitToProject(task.projectId, SOCKET_EVENTS.TASK_MOVED, task);
  return task;
}

/* ─── Dependencies ──────────────────────────────────────────── */

const depSelect = {
  id: true, blockingTaskId: true, blockedTaskId: true,
  blockingTask: { select: { id: true, title: true, status: true, dueDate: true } },
  blockedTask: { select: { id: true, title: true, status: true, dueDate: true } },
};

/** Both directions: what blocks this task, and what this task blocks. */
export async function listDependencies(taskId: string) {
  return prisma.taskDependency.findMany({
    where: { OR: [{ blockedTaskId: taskId }, { blockingTaskId: taskId }] },
    select: depSelect,
  });
}

/** Every dependency in the project — the Gantt needs the whole graph to draw arrows. */
export async function listProjectDependencies(projectId: string) {
  return prisma.taskDependency.findMany({
    where: { blockedTask: { projectId } },
    select: { id: true, blockingTaskId: true, blockedTaskId: true },
  });
}

export async function addDependency(blockedTaskId: string, blockingTaskId: string) {
  if (blockedTaskId === blockingTaskId) throw Object.assign(new Error('A task cannot depend on itself'), { status: 422 });

  const [blocked, blocking] = await Promise.all([
    prisma.task.findUnique({ where: { id: blockedTaskId }, select: { projectId: true } }),
    prisma.task.findUnique({ where: { id: blockingTaskId }, select: { projectId: true } }),
  ]);
  if (!blocked || !blocking) throw Object.assign(new Error('Task not found'), { status: 404 });
  if (blocked.projectId !== blocking.projectId) {
    throw Object.assign(new Error('Both tasks must belong to the same project'), { status: 422 });
  }

  const existing = await listProjectDependencies(blocked.projectId);
  if (detectCycles(existing, blockingTaskId, blockedTaskId)) {
    throw Object.assign(new Error('This dependency would create a cycle'), { status: 422 });
  }

  const dep = await prisma.taskDependency.create({ data: { blockedTaskId, blockingTaskId }, select: depSelect });
  emitToProject(blocked.projectId, SOCKET_EVENTS.TASK_UPDATED, { id: blockedTaskId, dependencyAdded: dep.id });
  return dep;
}

export async function removeDependency(taskId: string, depId: string) {
  const dep = await prisma.taskDependency.findUnique({
    where: { id: depId },
    select: { id: true, blockedTaskId: true, blockingTaskId: true, blockedTask: { select: { projectId: true } } },
  });
  if (!dep) throw Object.assign(new Error('Dependency not found'), { status: 404 });
  if (dep.blockedTaskId !== taskId && dep.blockingTaskId !== taskId) {
    throw Object.assign(new Error('Dependency does not belong to this task'), { status: 404 });
  }
  await prisma.taskDependency.delete({ where: { id: depId } });
  emitToProject(dep.blockedTask.projectId, SOCKET_EVENTS.TASK_UPDATED, { id: dep.blockedTaskId, dependencyRemoved: depId });
}

export async function getSubtasks(taskId: string) {
  return prisma.task.findMany({ where: { parentId: taskId }, select: taskSelect, orderBy: { order: 'asc' } });
}

export async function verifyTaskBelongsToProject(taskId: string, projectId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) throw Object.assign(new Error('Task not found in this project'), { status: 404 });
  return task;
}
