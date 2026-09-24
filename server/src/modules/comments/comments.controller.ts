import { Request, Response } from 'express';
import { ProjectRole } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './comments.service';

export const listByTask = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.listByTask(req.params.taskId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.create(req.params.taskId, req.user!.userId, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.update(req.params.id, req.user!.userId, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const role = req.projectMember?.role;
  const isManager = role === ProjectRole.OWNER || role === ProjectRole.MANAGER;
  await svc.remove(req.params.id, req.user!.userId, isManager);
  success(res, { message: 'Comment deleted' });
});
