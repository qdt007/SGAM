import { Request, Response } from 'express';
import { BlockerStatus } from '@prisma/client';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './blockers.service';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as BlockerStatus | undefined;
  success(res, await svc.list(req.params.projectId, status && status in BlockerStatus ? status : undefined));
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.get(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.create(req.params.projectId, req.user!.userId, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.update(req.params.id, req.body));
});

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.resolve(req.params.id, req.user!.userId, req.body));
});

export const reopen = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.reopen(req.params.id));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.remove(req.params.id));
});
