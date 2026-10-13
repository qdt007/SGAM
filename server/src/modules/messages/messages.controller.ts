import { Request, Response } from 'express';
import { ProjectRole } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './messages.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  success(
    res,
    await svc.list(req.params.projectId, {
      before: req.query.before as string | undefined,
      limit: Number.isNaN(limit) ? undefined : limit,
    }),
  );
});

export const listPinned = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.listPinned(req.params.projectId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.create(req.params.projectId, req.user!.userId, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  // Pinning is a project decision rather than the author's, so the role decides who may do it.
  const role = req.projectMember!.role;
  const canModerate = role === ProjectRole.OWNER || role === ProjectRole.MANAGER;
  if (req.body.pinned !== undefined && !canModerate) {
    res.status(403).json({ success: false, message: 'Only an owner or manager can pin a message' });
    return;
  }
  success(res, await svc.update(req.params.id, req.user!.userId, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const role = req.projectMember!.role;
  const canModerate = role === ProjectRole.OWNER || role === ProjectRole.MANAGER;
  success(res, await svc.remove(req.params.id, req.user!.userId, canModerate));
});
