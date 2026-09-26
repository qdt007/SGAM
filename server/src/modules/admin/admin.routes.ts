import { Router } from 'express';
import { GlobalRole } from '@prisma/client';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import * as ctrl from './admin.controller';
import { updateUserSchema } from './admin.schema';

const router = Router();

// Every route here is admin-only; the guard sits on the router so a new route cannot forget it.
router.use(authenticate, authorize(GlobalRole.ADMIN));

router.get('/stats', ctrl.getStats);
router.get('/users', ctrl.listUsers);
router.patch('/users/:id', validate(updateUserSchema), ctrl.updateUser);

export default router;
