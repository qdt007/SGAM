import { Router, Request, Response, NextFunction } from 'express';
import { ProjectRole } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeProject } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ctrl from './blockers.controller';
import { createBlockerSchema, updateBlockerSchema, resolveBlockerSchema } from './blockers.schema';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
// Anyone doing the work can raise a difficulty — a blocker only a manager may report is a
// blocker nobody reports.
const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER];

/** Mounted at /api/projects/:projectId/blockers */
const projectBlockersRouter = Router({ mergeParams: true });
projectBlockersRouter.use(authenticate);
projectBlockersRouter.get('/', authorizeProject(...READ_ROLES), ctrl.list);
projectBlockersRouter.post('/', authorizeProject(...WRITE_ROLES), validate(createBlockerSchema), ctrl.create);

/** Resolves :id (a blocker) to its project, then checks membership — never `authenticate` alone. */
function authorizeBlocker(...roles: ProjectRole[]) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const blocker = await prisma.blocker.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
    if (!blocker) {
      res.status(404).json({ success: false, message: 'Blocker not found' });
      return;
    }
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: blocker.projectId, userId: req.user!.userId } },
    });
    if (!membership) {
      res.status(403).json({ success: false, message: 'You are not a member of this project' });
      return;
    }
    if (!roles.includes(membership.role)) {
      res.status(403).json({ success: false, message: 'Insufficient project permissions' });
      return;
    }
    req.projectMember = membership;
    next();
  });
}

/** Mounted at /api/blockers */
const blockersRouter = Router();
blockersRouter.use(authenticate);
blockersRouter.get('/:id', authorizeBlocker(...READ_ROLES), ctrl.get);
blockersRouter.patch('/:id', authorizeBlocker(...WRITE_ROLES), validate(updateBlockerSchema), ctrl.update);
blockersRouter.post('/:id/resolve', authorizeBlocker(...WRITE_ROLES), validate(resolveBlockerSchema), ctrl.resolve);
blockersRouter.post('/:id/reopen', authorizeBlocker(...WRITE_ROLES), ctrl.reopen);
// Deleting loses the record of a difficulty the team hit, so it is the owner's and manager's
// call; resolving is what everyone else does instead.
blockersRouter.delete('/:id', authorizeBlocker(ProjectRole.OWNER, ProjectRole.MANAGER), ctrl.remove);

export { projectBlockersRouter, blockersRouter };
