import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeProject } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import * as ctrl from './tasks.controller';
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from './tasks.schema';

const projectTasksRouter = Router({ mergeParams: true });
projectTasksRouter.use(authenticate);
projectTasksRouter.get('/', authorizeProject('OWNER', 'MANAGER', 'MEMBER', 'VIEWER'), ctrl.listByProject);
projectTasksRouter.post('/', authorizeProject('OWNER', 'MANAGER', 'MEMBER'), validate(createTaskSchema), ctrl.create);

const tasksRouter = Router();
tasksRouter.use(authenticate);
tasksRouter.get('/:id', ctrl.get);
tasksRouter.patch('/:id', validate(updateTaskSchema), ctrl.update);
tasksRouter.delete('/:id', ctrl.remove);
tasksRouter.patch('/:id/move', validate(moveTaskSchema), ctrl.move);
tasksRouter.get('/:id/subtasks', ctrl.getSubtasks);

export { projectTasksRouter, tasksRouter };
