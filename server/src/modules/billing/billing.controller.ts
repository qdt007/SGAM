import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './billing.service';

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  success(res, svc.getPlans());
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getMine(req.user!.userId));
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.checkout(req.user!.userId, req.body), 201);
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.confirm(req.user!.userId, req.body));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.cancel(req.user!.userId));
});

export const resume = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.resume(req.user!.userId));
});
