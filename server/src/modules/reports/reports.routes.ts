import { Router } from 'express';
import { ProjectRole } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeProject } from '../../middlewares/authorize';
import { requirePro } from '../../middlewares/requirePlan';
import * as ctrl from './reports.controller';

const READ_ROLES = [ProjectRole.OWNER, ProjectRole.MANAGER, ProjectRole.MEMBER, ProjectRole.VIEWER];

/** Mounted at /api/projects/:projectId/reports */
const router = Router({ mergeParams: true });
router.use(authenticate);
router.get('/summary', authorizeProject(...READ_ROLES), requirePro('reports'), ctrl.summary);
router.get('/burndown', authorizeProject(...READ_ROLES), requirePro('reports'), ctrl.burndown);
router.get('/workload', authorizeProject(...READ_ROLES), requirePro('reports'), ctrl.workload);

export default router;
