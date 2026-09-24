import { Request, Response, NextFunction } from 'express';
import { GlobalRole, ProjectRole } from '@prisma/client';
import prisma from '../config/db';
export function authorize(...roles: GlobalRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }
    if (!roles.includes(req.user.role as GlobalRole)) { res.status(403).json({ success: false, message: 'Insufficient global permissions' }); return; }
    next();
  };
}
export function authorizeProject(...roles: ProjectRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }
    const projectId = req.params.projectId || req.params.id;
    if (!projectId) { res.status(400).json({ success: false, message: 'Project ID not found' }); return; }
    const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: req.user.userId } } });
    if (!membership) { res.status(403).json({ success: false, message: 'You are not a member of this project' }); return; }
    if (!roles.includes(membership.role)) { res.status(403).json({ success: false, message: 'Insufficient project permissions' }); return; }
    req.projectMember = membership;
    next();
  };
}
/** Resolves a task-scoped route (`:taskId` or `:id`) to its project, then checks membership role. */
export function authorizeTask(...roles: ProjectRole[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ success: false, message: 'Not authenticated' }); return; }
    const taskId = req.params.taskId || req.params.id;
    if (!taskId) { res.status(400).json({ success: false, message: 'Task ID not found' }); return; }
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, projectId: true } });
    if (!task) { res.status(404).json({ success: false, message: 'Task not found' }); return; }
    const membership = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: task.projectId, userId: req.user.userId } } });
    if (!membership) { res.status(403).json({ success: false, message: 'You are not a member of this project' }); return; }
    if (!roles.includes(membership.role)) { res.status(403).json({ success: false, message: 'Insufficient project permissions' }); return; }
    req.projectMember = membership;
    req.taskProjectId = task.projectId;
    next();
  };
}
