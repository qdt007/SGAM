import prisma from '../../config/db';
import { CreateProjectInput, UpdateProjectInput } from './projects.schema';
import { ProjectRole } from '@prisma/client';

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

export async function getProject(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: { select: { id: true, displayName: true, avatarUrl: true, email: true } } } },
      columns: { orderBy: { order: 'asc' } },
      _count: { select: { tasks: true, members: true } },
    },
  });
  if (!project) throw Object.assign(new Error('Project not found'), { status: 404 });
  return project;
}

export async function updateProject(projectId: string, input: UpdateProjectInput) {
  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...input,
      startDate: input.startDate !== undefined ? (input.startDate ? new Date(input.startDate) : null) : undefined,
      endDate: input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : undefined,
    },
    include: { _count: { select: { tasks: true, members: true } } },
  });
}

export async function deleteProject(projectId: string) {
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
  return prisma.projectMember.create({
    data: { projectId, userId, role },
    include: { user: { select: { id: true, email: true, username: true, displayName: true, avatarUrl: true } } },
  });
}

export async function updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
  return prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });
}

export async function removeMember(projectId: string, userId: string) {
  await prisma.projectMember.delete({ where: { projectId_userId: { projectId, userId } } });
}

export async function getColumns(projectId: string) {
  return prisma.kanbanColumn.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
  });
}

export async function createColumn(projectId: string, data: { name: string; color?: string }) {
  const last = await prisma.kanbanColumn.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });
  return prisma.kanbanColumn.create({ data: { projectId, name: data.name, color: data.color, order: (last?.order ?? -1) + 1 } });
}

export async function updateColumn(columnId: string, data: { name?: string; color?: string }) {
  return prisma.kanbanColumn.update({ where: { id: columnId }, data });
}

export async function deleteColumn(columnId: string) {
  await prisma.kanbanColumn.delete({ where: { id: columnId } });
}

export async function getTags(projectId: string) {
  const projectTags = await prisma.projectTag.findMany({
    where: { projectId },
    include: { tag: true },
  });
  return projectTags.map((pt) => pt.tag);
}
