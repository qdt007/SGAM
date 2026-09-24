import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './notifications.service';
import { listNotificationsSchema } from './notifications.schema';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, unreadOnly = false } = listNotificationsSchema.parse(req.query);
  const { items, meta } = await svc.list(req.user!.userId, page, limit, unreadOnly);
  success(res, items, 200, meta);
});

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getUnreadCount(req.user!.userId));
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await svc.markRead(req.user!.userId, req.params.id);
  success(res, { message: 'Marked as read' });
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.markAllRead(req.user!.userId));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.remove(req.user!.userId, req.params.id);
  success(res, { message: 'Notification deleted' });
});

export const clearAll = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.clearAll(req.user!.userId));
});
