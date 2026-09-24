import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import * as ctrl from './users.controller';
import { updateMeSchema, changePasswordSchema, updateNotificationPrefsSchema } from './users.schema';

const router = Router();
router.use(authenticate);

router.get('/search', ctrl.search);
router.get('/me/stats', ctrl.getMyStats);
router.patch('/me', validate(updateMeSchema), ctrl.updateMe);
router.patch('/me/password', validate(changePasswordSchema), ctrl.changePassword);
router.get('/me/notification-prefs', ctrl.getNotificationPrefs);
router.patch('/me/notification-prefs', validate(updateNotificationPrefsSchema), ctrl.updateNotificationPrefs);
router.get('/:id', ctrl.getById);

export default router;
