import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import * as ctrl from './notifications.controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/clear-all', ctrl.clearAll);
router.delete('/:id', ctrl.remove);

export default router;
