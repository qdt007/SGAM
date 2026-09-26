import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { success } from '../../utils/apiResponse';
import * as svc from './billing.service';

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  success(res, svc.getPlans());
});

export const getMine = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.getMine(req.user!.userId));
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  // `trust proxy` is on in production, so req.ip is the real caller rather than Render's edge.
  success(res, await svc.checkout(req.user!.userId, req.body, req.ip ?? '127.0.0.1'), 201);
});

/**
 * Server-to-server callback from VNPay. It is unauthenticated by necessity — VNPay has no
 * session — and safe because nothing is trusted until the HMAC over the query string checks out.
 */
export const vnpayIpn = asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.handleVnpayIpn(req.query as Record<string, string>));
});

/** Where the customer's browser comes back to. Reports; never grants. */
export const vnpayReturn = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.readVnpayReturn(req.query as Record<string, string>);
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
  const status = !result.valid ? 'invalid' : result.succeeded ? 'success' : 'failed';
  res.redirect(`${base}/settings?tab=billing&payment=${status}&settled=${result.settled ? '1' : '0'}`);
});

export const confirm = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.confirm(req.user!.userId, req.body));
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.cancel(req.user!.userId));
});

export const resume = asyncHandler(async (req: Request, res: Response) => {
  success(res, await svc.resume(req.user!.userId));
});
