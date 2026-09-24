import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { ProjectRole } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeTask } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ctrl from './comments.controller';
import { createCommentSchema, updateCommentSchema } from './comments.schema';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER];

/** Mounted at /api/tasks/:taskId/comments */
const taskCommentsRouter = Router({ mergeParams: true });
taskCommentsRouter.use(authenticate);
taskCommentsRouter.get('/', authorizeTask(...READ_ROLES), ctrl.listByTask);
taskCommentsRouter.post('/', authorizeTask(...WRITE_ROLES), validate(createCommentSchema), ctrl.create);

/** Resolves :id (a comment) to its project so membership can be checked. */
const authorizeComment = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
  if (!comment?.projectId) { res.status(404).json({ success: false, message: 'Comment not found' }); return; }
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: comment.projectId, userId: req.user!.userId } },
  });
  if (!membership) { res.status(403).json({ success: false, message: 'You are not a member of this project' }); return; }
  req.projectMember = membership;
  next();
});

/** Mounted at /api/comments */
const commentsRouter = Router();
commentsRouter.use(authenticate);
commentsRouter.patch('/:id', authorizeComment, validate(updateCommentSchema), ctrl.update);
commentsRouter.delete('/:id', authorizeComment, ctrl.remove);

export { taskCommentsRouter, commentsRouter };
