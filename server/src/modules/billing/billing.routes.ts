import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import * as ctrl from './billing.controller';
import { checkoutSchema, confirmSchema } from './billing.schema';

const router = Router();

// The catalogue is public so the pricing page renders before sign-in.
router.get('/plans', ctrl.getPlans);

// The gateways call these without a session, so they must sit above the authenticate guard.
// No handler trusts its input before the signature is verified, and only the two server-to-server
// callbacks — payos/webhook and vnpay/ipn — can grant anything. The return URLs only report.
router.post('/payos/webhook', ctrl.payosWebhook);
router.get('/payos/return', ctrl.payosReturn);
router.get('/vnpay/ipn', ctrl.vnpayIpn);
router.get('/vnpay/return', ctrl.vnpayReturn);

router.use(authenticate);
router.get('/me', ctrl.getMine);
router.post('/checkout', validate(checkoutSchema), ctrl.checkout);
router.post('/confirm', validate(confirmSchema), ctrl.confirm);
router.post('/cancel', ctrl.cancel);
router.post('/resume', ctrl.resume);

export default router;
