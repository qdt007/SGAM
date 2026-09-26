import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { validate } from '../../middlewares/validate';
import * as ctrl from './billing.controller';
import { checkoutSchema, confirmSchema } from './billing.schema';

const router = Router();

// The catalogue is public so the pricing page renders before sign-in.
router.get('/plans', ctrl.getPlans);

// VNPay calls these without a session, so they must sit above the authenticate guard.
// Neither trusts its input before the HMAC signature is verified.
router.get('/vnpay/ipn', ctrl.vnpayIpn);
router.get('/vnpay/return', ctrl.vnpayReturn);

router.use(authenticate);
router.get('/me', ctrl.getMine);
router.post('/checkout', validate(checkoutSchema), ctrl.checkout);
router.post('/confirm', validate(confirmSchema), ctrl.confirm);
router.post('/cancel', ctrl.cancel);
router.post('/resume', ctrl.resume);

export default router;
