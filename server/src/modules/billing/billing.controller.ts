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
 * **A payload that fails verification is acknowledged with 200 and acted on in no way.** This
 * used to answer 401, on the reasoning that 2xx would make payOS treat it as delivered and stop
 * retrying. That reasoning was wrong: a request that fails the signature check did not come from
 * payOS, so there is no delivery for payOS to retry. What it did break was registration — payOS
 * probes the URL when you save it and refuses the whole webhook if the probe is not 2xx, which
 * is exactly the 401 it reported back.
 *
 * The cost of answering 200 is that a wrong checksum key would silently swallow real payments
 * instead of making payOS retry, so a failure is logged loudly rather than passed over in
 * silence. A payment that never activates Pro is the visible symptom either way.
 */
export const payosWebhook = asyncHandler(async (req: Request, res: Response) => {
  try {
    res.json(await svc.handlePayosWebhook(req.body));
  } catch (err) {
    // A server with no payOS credentials cannot judge a signature either way, and answering
    // "invalid signature" to that would send whoever is debugging it after the wrong fault.
    if ((err as { status?: number })?.status === 503) {
      res.status(503).json({ success: false, message: 'payOS is not configured' });
      return;
    }
    const body = req.body as { data?: { orderCode?: unknown } } | undefined;
    console.warn(
      '[payOS] webhook failed verification, ignoring:',
      (err as Error)?.message ?? err,
      '| orderCode:',
      body?.data?.orderCode ?? '(none)',
      '| keys:',
      Object.keys(body ?? {}).join(','),
    );
    res.json({ success: true, message: 'Acknowledged, not processed' });
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
