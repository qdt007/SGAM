import { Router } from 'express';
import { ProjectRole } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeTask } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import * as ctrl from './timeTracking.controller';
import { stopTimerSchema, logManualSchema, updateTimeLogSchema } from './timeTracking.schema';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER];

/** Mounted at /api/tasks/:taskId/time */
const taskTimeRouter = Router({ mergeParams: true });
taskTimeRouter.use(authenticate);
taskTimeRouter.get('/', authorizeTask(...READ_ROLES), ctrl.listByTask);
taskTimeRouter.post('/', authorizeTask(...WRITE_ROLES), validate(logManualSchema), ctrl.logManual);
taskTimeRouter.post('/start', authorizeTask(...WRITE_ROLES), ctrl.startTimer);
taskTimeRouter.post('/stop', authorizeTask(...WRITE_ROLES), validate(stopTimerSchema), ctrl.stopTimer);

/** Mounted at /api/time — ownership is checked in the service, not by project role. */
const timeRouter = Router();
timeRouter.use(authenticate);
timeRouter.get('/running', ctrl.getRunning);
timeRouter.patch('/:id', validate(updateTimeLogSchema), ctrl.update);
timeRouter.delete('/:id', ctrl.remove);

export { taskTimeRouter, timeRouter };
