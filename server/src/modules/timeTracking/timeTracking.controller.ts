import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './timeTracking.service';

export const getRunning = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getRunning(req.user!.userId));
});

export const startTimer = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.startTimer(req.params.taskId, req.user!.userId), 201);
});

export const stopTimer = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.stopTimer(req.params.taskId, req.user!.userId, req.body));
});

export const logManual = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.logManual(req.params.taskId, req.user!.userId, req.body), 201);
});

export const listByTask = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.listByTask(req.params.taskId));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.update(req.params.id, req.user!.userId, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.remove(req.params.id, req.user!.userId);
  success(res, { message: 'Time log deleted' });
});
