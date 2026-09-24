import { Request, Response } from 'express';
import { ProjectRole } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './files.service';
import { attachFileSchema } from './files.schema';

export const attachToTask = asyncHandler(async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const { commentId } = attachFileSchema.parse(req.body ?? {});
  success(res, await svc.attachToTask(req.params.taskId, req.user!.userId, files, commentId), 201);
});

export const listByTask = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.listByTask(req.params.taskId));
});

export const listByProject = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.listByProject(req.params.projectId));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const role = req.projectMember?.role;
  const isManager = role === ProjectRole.OWNER || role === ProjectRole.MANAGER;
  await svc.remove(req.params.id, req.user!.userId, isManager);
  success(res, { message: 'File deleted' });
});
