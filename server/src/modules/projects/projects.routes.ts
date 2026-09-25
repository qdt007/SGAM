import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorizeProject } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { enforceProjectQuota, enforceMemberQuota } from '../../middlewares/requirePlan';
import * as ctrl from './projects.controller';
import { createProjectSchema, updateProjectSchema, addMemberSchema, updateMemberSchema, createColumnSchema, updateColumnSchema, addTagSchema } from './projects.schema';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', enforceProjectQuota, validate(createProjectSchema), ctrl.create);
router.get('/:id', authorizeProject('OWNER', 'MANAGER', 'MEMBER', 'VIEWER'), ctrl.get);
router.patch('/:id', authorizeProject('OWNER', 'MANAGER'), validate(updateProjectSchema), ctrl.update);
router.delete('/:id', authorizeProject('OWNER'), ctrl.remove);

router.get('/:projectId/members', authorizeProject('OWNER', 'MANAGER', 'MEMBER', 'VIEWER'), ctrl.getMembers);
router.post('/:projectId/members', authorizeProject('OWNER', 'MANAGER'), enforceMemberQuota, validate(addMemberSchema), ctrl.addMember);
router.patch('/:projectId/members/:userId', authorizeProject('OWNER', 'MANAGER'), validate(updateMemberSchema), ctrl.updateMember);
router.delete('/:projectId/members/:userId', authorizeProject('OWNER', 'MANAGER'), ctrl.removeMember);

router.get('/:projectId/columns', authorizeProject('OWNER', 'MANAGER', 'MEMBER', 'VIEWER'), ctrl.getColumns);
router.post('/:projectId/columns', authorizeProject('OWNER', 'MANAGER'), validate(createColumnSchema), ctrl.createColumn);
router.patch('/:projectId/columns/:columnId', authorizeProject('OWNER', 'MANAGER'), validate(updateColumnSchema), ctrl.updateColumn);
router.delete('/:projectId/columns/:columnId', authorizeProject('OWNER', 'MANAGER'), ctrl.deleteColumn);

router.get('/:projectId/tags', authorizeProject('OWNER', 'MANAGER', 'MEMBER', 'VIEWER'), ctrl.getTags);
router.post('/:projectId/tags', authorizeProject('OWNER', 'MANAGER', 'MEMBER'), validate(addTagSchema), ctrl.addTag);
router.delete('/:projectId/tags/:tagId', authorizeProject('OWNER', 'MANAGER'), ctrl.removeTag);

export default router;
