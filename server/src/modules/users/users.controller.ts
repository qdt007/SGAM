import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './users.service';

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { q = '', projectId, limit } = req.query as Record<string, string>;
  success(res, await svc.search(q, projectId, Math.min(50, parseInt(limit || '10', 10))));
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateMe(req.user!.userId, req.body));
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await svc.changePassword(req.user!.userId, req.body);
  success(res, { message: 'Password updated. Please sign in again on your other devices.' });
});

export const getMyStats = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getMyStats(req.user!.userId));
});

export const getNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getNotificationPrefs(req.user!.userId));
});

export const updateNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateNotificationPrefs(req.user!.userId, req.body));
});

export const setAvatar = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) throw Object.assign(new Error('No image uploaded'), { status: 400 });
  success(res, await svc.setAvatar(req.user!.userId, file));
});

export const removeAvatar = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.removeAvatar(req.user!.userId));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getById(req.params.id));
});
