import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, error } from '../../utils/apiResponse';
import * as svc from './projects.service';
import { ProjectRole } from '@prisma/client';

export const list = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.listProjects(req.user!.userId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.createProject(req.user!.userId, req.body), 201);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getProject(req.params.id));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateProject(req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteProject(req.params.id);
  success(res, { message: 'Project deleted' });
});

export const getMembers = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getMembers(req.params.projectId));
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const { userId, role } = req.body;
  success(res, await svc.addMember(req.params.projectId, userId, role as ProjectRole), 201);
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateMemberRole(req.params.projectId, req.params.userId, req.body.role as ProjectRole));
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  await svc.removeMember(req.params.projectId, req.params.userId);
  success(res, { message: 'Member removed' });
});

export const getColumns = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getColumns(req.params.projectId));
});

export const createColumn = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.createColumn(req.params.projectId, req.body), 201);
});

export const updateColumn = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateColumn(req.params.columnId, req.body));
});

export const deleteColumn = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteColumn(req.params.columnId);
  success(res, { message: 'Column deleted' });
});

export const getTags = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getTags(req.params.projectId));
});
