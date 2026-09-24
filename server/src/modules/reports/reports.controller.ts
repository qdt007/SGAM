import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './reports.service';
import { burndownQuerySchema } from './reports.schema';

export const burndown = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.burndown(req.params.projectId, burndownQuerySchema.parse(req.query)));
});

export const workload = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.workload(req.params.projectId));
});

export const summary = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.summary(req.params.projectId));
});
