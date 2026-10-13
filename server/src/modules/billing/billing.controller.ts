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
  backToBilling(res, !result.valid ? 'invalid' : result.succeeded ? 'success' : 'failed', result.settled);
});

/** Where a returning customer is sent, whichever provider handled the payment. */
function backToBilling(res: Response, status: string, settled: boolean) {
  const base = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
  res.redirect(`${base}/settings?tab=billing&payment=${status}&settled=${settled ? '1' : '0'}`);
}

/**
 * Server-to-server callback from payOS. Unauthenticated by necessity — payOS has no session —
 * and safe because the service verifies the payload's signature before reading anything from it.
 *
 * A bad signature is the one case that must not answer 2xx: payOS would take that as delivered
 * and stop retrying, and a request that fails the check did not come from payOS anyway.
 */
export const payosWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    res.json(await svc.handlePayosWebhook(req.body));
  } catch (err) {
    // A server with no payOS credentials cannot judge a signature either way, and answering
    // "invalid signature" to that would send whoever is debugging it after the wrong fault.
    const unconfigured = (err as { status?: number })?.status === 503;
    res
      .status(unconfigured ? 503 : 401)
      .json({ success: false, message: unconfigured ? 'payOS is not configured' : 'Invalid signature' });
  }
});

/** Where the customer's browser comes back to. Reports; never grants. */
export const payosReturn = asyncHandler(async (req: Request, res: Response) => {
  const result = await svc.readPayosReturn(req.query as Record<string, string>);
  backToBilling(res, result.cancelled ? 'cancelled' : result.succeeded ? 'success' : 'failed', result.settled);
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
