import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import { parsePaginationQuery, buildMeta } from '../../utils/pagination';
import * as svc from './admin.service';

export const getStats = asyncHandler(async (_req: Request, res: Response) => {
  success(res, await svc.getStats());
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePaginationQuery(req.query);
  const { items, total } = await svc.listUsers({ q: req.query.q as string | undefined, page, limit });
  res.json({ success: true, data: items, meta: buildMeta(total, page, limit) });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateUser(req.user!.userId, req.params.id, req.body));
});
