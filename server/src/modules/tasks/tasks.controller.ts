import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './tasks.service';

export const listByProject = asyncHandler(async (req: Request, res: Response) => {
  const { status, assigneeId, priority, search } = req.query as Record<string, string>;
  success(res, await svc.listByProject(req.params.projectId, { status, assigneeId, priority, search }));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.createTask(req.params.projectId, req.user!.userId, req.body), 201);
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getTask(req.params.id));
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.updateTask(req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await svc.deleteTask(req.params.id);
  success(res, { message: 'Task deleted' });
});

export const move = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.moveTask(req.params.id, req.body));
});

export const getSubtasks = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getSubtasks(req.params.id));
});
