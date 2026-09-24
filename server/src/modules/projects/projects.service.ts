import prisma from '../../config/db';
import { emitToProject } from '../../config/socket';
import { SOCKET_EVENTS } from '../../constants/events';
import { enqueueNotification } from '../../jobs/notificationQueue';
import { CreateProjectInput, UpdateProjectInput } from './projects.schema';
import { NotificationType, ProjectRole } from '@prisma/client';

export async function listProjects(userId: string) {
  return prisma.project.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createProject(userId: string, input: CreateProjectInput) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        priority: input.priority,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        coverColor: input.coverColor,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: {
        members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        _count: { select: { tasks: true, members: true } },
      },
    });
    await tx.kanbanColumn.createMany({
      data: [
        { projectId: project.id, name: 'To Do', order: 0, color: '#6366f1' },
        { projectId: project.id, name: 'In Progress', order: 1, color: '#f59e0b' },
        { projectId: project.id, name: 'Done', order: 2, color: '#10b981' },
      ],
    });
    return project;
  });
}

export async function getProject(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, email: true } } } },
      columns: { orderBy: { order: 'asc' } },
      _count: { select: { tasks: true, members: true } },
    },
  });
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
  return project;
}

export async function updateProject(projectId: string, userId: string, input: UpdateProjectInput) {
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!member || !['OWNER', 'MANAGER'].includes(member.role))
    throw Object.assign(new Error('Access denied'), { status: 403 });
  const project = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...input,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : undefined,
    },
    include: { _count: { select: { tasks: true, members: true } } },
  });
  emitToProject(projectId, SOCKET_EVENTS.PROJECT_UPDATED, project);
  return project;
}

export async function deleteProject(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!member || member.role !== 'OWNER')
    throw Object.assign(new Error('Only the owner can delete this project'), { status: 403 });
  await prisma.project.delete({ where: { id: projectId } });
}

export async function getMembers(projectId: string) {
  return prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } } },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function addMember(projectId: string, userId: string, role: ProjectRole = 'MEMBER') {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (existing) throw Object.assign(new Error('User is already a member'), { status: 409 });
  const member = await prisma.projectMember.create({
    data: { projectId, userId, role },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } } },
  });
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  emitToProject(projectId, SOCKET_EVENTS.MEMBER_ADDED, member);
  await enqueueNotification({
    recipientId: userId, type: NotificationType.PROJECT_INVITE,
    message: `You were added to "${project?.name ?? 'a project'}" as ${role}`,
  });
  return member;
}

export async function updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
  const member = await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
  emitToProject(projectId, SOCKET_EVENTS.MEMBER_UPDATED, member);
  return member;
}

export async function removeMember(projectId: string, userId: string) {
  const owners = await prisma.projectMember.count({ where: { projectId, role: 'OWNER' } });
  const target = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId } } });
  if (!target) throw Object.assign(new Error('Member not found'), { status: 404 });
  // Removing the last owner would leave the project unadministrable.
  if (target.role === 'OWNER' && owners <= 1) {
    throw Object.assign(new Error('Cannot remove the last owner of the project'), { status: 409 });
  }
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
  emitToProject(projectId, SOCKET_EVENTS.MEMBER_REMOVED, { projectId, userId });
}

export async function getColumns(projectId: string) {
  return prisma.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
}

export async function createColumn(projectId: string, data: { name: string; color?: string }) {
  const last = await prisma.kanbanColumn.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });
  const column = await prisma.kanbanColumn.create({ data: { projectId, name: data.name, color: data.color, order: (last?.order ?? -1) + 1 } });
  emitToProject(projectId, SOCKET_EVENTS.COLUMN_UPDATED, { action: 'created', column });
  return column;
}

export async function updateColumn(columnId: string, data: { name?: string; color?: string }) {
  const column = await prisma.kanbanColumn.update({ where: { id: columnId }, data });
  emitToProject(column.projectId, SOCKET_EVENTS.COLUMN_UPDATED, { action: 'updated', column });
  return column;
}

export async function deleteColumn(columnId: string) {
  const column = await prisma.kanbanColumn.delete({ where: { id: columnId } });
  emitToProject(column.projectId, SOCKET_EVENTS.COLUMN_UPDATED, { action: 'deleted', column });
}

export async function getTags(projectId: string) {
  const projectTags = await prisma.projectTag.findMany({
    where: { projectId },
    include: { tag: true },
  });
  return projectTags.map((pt) => pt.tag);
}
