import { Router } from 'express';
import * as authController from './auth.controller';
import { validate } from '../../middlewares/validate';
import { authenticate } from '../../middlewares/authenticate';
import { authLimiter, registerLimiter } from '../../middlewares/rateLimiter';
import { registerSchema, loginSchema, refreshSchema, twoFactorTokenSchema, twoFactorVerifySchema, twoFactorDisableSchema } from './auth.schema';
const router = Router();
router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticate, authController.logoutEverywhere);

// Finishing a login is rate-limited like the password step: it is the same guessing surface.
router.get('/google', authController.googleStart);
router.get('/google/callback', authController.googleCallback);

router.post('/2fa/verify', authLimiter, validate(twoFactorVerifySchema), authController.twoFactorVerify);
router.get('/2fa', authenticate, authController.twoFactorStatus);
router.post('/2fa/setup', authenticate, authController.twoFactorSetup);
router.post('/2fa/enable', authenticate, validate(twoFactorTokenSchema), authController.twoFactorEnable);
router.post('/2fa/disable', authenticate, validate(twoFactorDisableSchema), authController.twoFactorDisable);
router.get('/me', authenticate, authController.getMe);
export default router;
