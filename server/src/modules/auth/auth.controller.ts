import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, error } from '../../utils/apiResponse';
import * as authService from './auth.service';
import { signOAuthState, verifyOAuthState } from '../../utils/jwt';
export const register = asyncHandler(async (req: Request, res: Response) => { success(res, await authService.register(req.body), 201); });
export const login = asyncHandler(async (req: Request, res: Response) => { success(res, await authService.login(req.body)); });
export const refresh = asyncHandler(async (req: Request, res: Response) => { success(res, await authService.refreshTokens(req.body.refreshToken)); });
export const logout = asyncHandler(async (req: Request, res: Response) => { if (req.body.refreshToken) await authService.logout(req.body.refreshToken); success(res, { message: 'Logged out' }); });
export const logoutEverywhere = asyncHandler(async (req: Request, res: Response) => {
  const revoked = await authService.logoutEverywhere(req.user!.userId);
  success(res, { revoked, message: 'Signed out on every device. You will need to sign in again.' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) { error(res, 'Not authenticated', 401); return; }
  success(res, await authService.getMe(req.user.userId));
});

export const twoFactorStatus = asyncHandler(async (req: Request, res: Response) => {
  success(res, await authService.getTwoFactorStatus(req.user!.userId));
});

export const twoFactorSetup = asyncHandler(async (req: Request, res: Response) => {
  success(res, await authService.startTwoFactorSetup(req.user!.userId));
});

export const twoFactorEnable = asyncHandler(async (req: Request, res: Response) => {
  success(res, await authService.enableTwoFactor(req.user!.userId, req.body.token));
});

export const twoFactorDisable = asyncHandler(async (req: Request, res: Response) => {
  await authService.disableTwoFactor(req.user!.userId, req.body.password);
  success(res, { message: 'Two-factor authentication is off.' });
});

export const twoFactorVerify = asyncHandler(async (req: Request, res: Response) => {
  success(res, await authService.verifyTwoFactorLogin(req.body.challengeToken, req.body.code));
});

/* ─── Google sign-in ─────────────────────────────────────── */

/** CLIENT_URL may list several origins; the first is the one we send people back to. */
function frontendOrigin(): string {
  return (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
}

/**
 * Results ride back in the URL fragment, not the query string: fragments are never sent to a
 * server, so the tokens stay out of proxy and access logs. The page clears them immediately.
 */
function redirectToClient(res: Response, params: Record<string, string>): void {
  res.redirect(`${frontendOrigin()}/auth/google#${new URLSearchParams(params)}`);
}

/**
 * Hands back the Google URL instead of redirecting to it.
 *
 * Redirecting from here meant a no-reputation *.onrender.com address sent the browser straight
 * to a Google sign-in page, which is precisely the shape of a phishing site — Chrome Safe
 * Browsing flagged this route as dangerous. Letting the frontend navigate means the jump to
 * Google starts from the app's own origin, which is the ordinary OAuth pattern.
 */
export const googleStart = asyncHandler(async (_req: Request, res: Response) => {
  if (!authService.googleConfigured()) {
    throw Object.assign(new Error('Google sign-in is not configured on this server'), { status: 503 });
  }
  success(res, { url: authService.googleAuthUrl(signOAuthState()) });
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  // The user pressing "Cancel" on Google's screen is not an error worth a stack trace.
  if (error || !code) return redirectToClient(res, { error: error || 'Sign-in was cancelled' });

  try {
    verifyOAuthState(state ?? '');
  } catch {
    return redirectToClient(res, { error: 'This sign-in link expired. Try again.' });
  }

  try {
    const result = await authService.loginWithGoogle(code);
    if ('requiresTwoFactor' in result) return redirectToClient(res, { challengeToken: result.challengeToken });
    redirectToClient(res, { accessToken: result.accessToken, refreshToken: result.refreshToken });
  } catch (e) {
    redirectToClient(res, { error: (e as Error).message || 'Google sign-in failed' });
  }
});
