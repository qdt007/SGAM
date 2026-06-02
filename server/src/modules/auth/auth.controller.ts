import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success, error } from '../../utils/apiResponse';
import * as authService from './auth.service';
export const register = asyncHandler(async (req: Request, res: Response) => { success(res, await authService.register(req.body), 201); });
export const login = asyncHandler(async (req: Request, res: Response) => { success(res, await authService.login(req.body)); });
export const refresh = asyncHandler(async (req: Request, res: Response) => { success(res, await authService.refreshTokens(req.body.refreshToken)); });
export const logout = asyncHandler(async (req: Request, res: Response) => { if (req.body.refreshToken) await authService.logout(req.body.refreshToken); success(res, { message: 'Logged out' }); });
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) { error(res, 'Not authenticated', 401); return; }
  success(res, await authService.getMe(req.user.userId));
});
