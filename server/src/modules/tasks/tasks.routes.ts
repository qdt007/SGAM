import { Router } from 'express';
import { ProjectRole } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeProject, authorizeTask } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { requirePro } from '../../middlewares/requirePlan';
import * as ctrl from './tasks.controller';
import { createTaskSchema, updateTaskSchema, moveTaskSchema, addDependencySchema, setTaskTagsSchema } from './tasks.schema';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];
const WRITE_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER];

/** Mounted at /api/projects/:projectId/tasks */
const projectTasksRouter = Router({ mergeParams: true });
projectTasksRouter.use(authenticate);
projectTasksRouter.get('/', authorizeProject(...READ_ROLES), ctrl.listByProject);
projectTasksRouter.post('/', authorizeProject(...WRITE_ROLES), validate(createTaskSchema), ctrl.create);
projectTasksRouter.get('/dependencies', authorizeProject(...READ_ROLES), requirePro('gantt'), ctrl.listProjectDependencies);

/** Mounted at /api/tasks — each route resolves the task to its project before checking the role. */
const tasksRouter = Router();
tasksRouter.use(authenticate);
tasksRouter.get('/:id', authorizeTask(...READ_ROLES), ctrl.get);
tasksRouter.patch('/:id', authorizeTask(...WRITE_ROLES), validate(updateTaskSchema), ctrl.update);
tasksRouter.delete('/:id', authorizeTask(ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER), ctrl.remove);
tasksRouter.patch('/:id/move', authorizeTask(...WRITE_ROLES), validate(moveTaskSchema), ctrl.move);
tasksRouter.put('/:id/tags', authorizeTask(...WRITE_ROLES), validate(setTaskTagsSchema), ctrl.setTags);

tasksRouter.get('/:id/subtasks', authorizeTask(...READ_ROLES), ctrl.getSubtasks);
tasksRouter.post('/:id/subtasks', authorizeTask(...WRITE_ROLES), validate(createTaskSchema), ctrl.createSubtask);

tasksRouter.get('/:id/dependencies', authorizeTask(...READ_ROLES), ctrl.listDependencies);
tasksRouter.post('/:id/dependencies', authorizeTask(...WRITE_ROLES), requirePro('gantt'), validate(addDependencySchema), ctrl.addDependency);
tasksRouter.delete('/:id/dependencies/:depId', authorizeTask(...WRITE_ROLES), ctrl.removeDependency);

export { projectTasksRouter, tasksRouter };
