import { Router, Request, Response, NextFunction } from 'express';
import { ProjectRole } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeTask, authorizeProject } from '../../middlewares/authorize';
import { asyncHandler } from '../../utils/asyncHandler';
import { upload } from '../../config/upload';
import { enforceUploadQuota } from '../../middlewares/requirePlan';
import * as ctrl from './files.controller';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER];

/** Mounted at /api/tasks/:taskId/files */
const taskFilesRouter = Router({ mergeParams: true });
taskFilesRouter.use(authenticate);
taskFilesRouter.get('/', authorizeTask(...READ_ROLES), ctrl.listByTask);
taskFilesRouter.post('/', authorizeTask(...WRITE_ROLES), upload.array('files', 5), enforceUploadQuota, ctrl.attachToTask);

/** Mounted at /api/projects/:projectId/files */
const projectFilesRouter = Router({ mergeParams: true });
projectFilesRouter.use(authenticate);
projectFilesRouter.get('/', authorizeProject(...READ_ROLES), ctrl.listByProject);

/** Resolves :id (a file) to its project so membership can be checked. */
const authorizeFile = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const file = await prisma.file.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
  if (!file?.projectId) { res.status(404).json({ success: false, message: 'File not found' }); return; }
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: file.projectId, userId: req.user!.userId } },
  });
  if (!membership) { res.status(403).json({ success: false, message: 'You are not a member of this project' }); return; }
  req.projectMember = membership;
  next();
});

/** Mounted at /api/files */
const filesRouter = Router();
filesRouter.use(authenticate);
filesRouter.delete('/:id', authorizeFile, ctrl.remove);

export { taskFilesRouter, projectFilesRouter, filesRouter };
