import { Router, Request, Response, NextFunction } from 'express';
import { ProjectRole } from '@prisma/client';
import prisma from '../../config/db';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeProject } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import * as ctrl from './messages.controller';
import { createMessageSchema, updateMessageSchema } from './messages.schema';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
// A VIEWER reads the project without taking part in it, so they read the chat without posting.
const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER];

/** Mounted at /api/projects/:projectId/messages */
const projectMessagesRouter = Router({ mergeParams: true });
projectMessagesRouter.use(authenticate);
projectMessagesRouter.get('/', authorizeProject(...READ_ROLES), ctrl.list);
projectMessagesRouter.get('/pinned', authorizeProject(...READ_ROLES), ctrl.listPinned);
projectMessagesRouter.post('/', authorizeProject(...WRITE_ROLES), validate(createMessageSchema), ctrl.create);

/**
 * Resolves :id (a message) to its project so membership can be checked. Without this a message
 * id would be editable by anyone who knows it, the way task-scoped routes were before
 * authorizeTask existed.
 */
const authorizeMessage = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const message = await prisma.message.findUnique({ where: { id: req.params.id }, select: { projectId: true } });
  if (!message) {
    res.status(404).json({ success: false, message: 'Message not found' });
    return;
  }
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: message.projectId, userId: req.user!.userId } },
  });
  if (!membership) {
    res.status(403).json({ success: false, message: 'You are not a member of this project' });
    return;
  }
  if (membership.role === ProjectRole.VIEWER) {
    res.status(403).json({ success: false, message: 'Insufficient project permissions' });
    return;
  }
  req.projectMember = membership;
  next();
});

/** Mounted at /api/messages */
const messagesRouter = Router();
messagesRouter.use(authenticate);
messagesRouter.patch('/:id', authorizeMessage, validate(updateMessageSchema), ctrl.update);
messagesRouter.delete('/:id', authorizeMessage, ctrl.remove);

export { projectMessagesRouter, messagesRouter };
