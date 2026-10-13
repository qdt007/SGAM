import crypto from 'crypto';
import { PlanTier, BillingCycle, PaymentStatus } from '@prisma/client';
import prisma from '../../config/db';
import { PLANS, priceFor, periodEndFrom, limitsFor, yearlySavingPercent } from '../../constants/plans';
import { CheckoutInput, ConfirmInput } from './billing.schema';
import { buildPaymentUrl, verifyCallback, vnpayConfigured } from '../../config/vnpay';
import { createPaymentLink, payosConfigured, verifyWebhook, type WebhookData } from '../../config/payos';
import type { Webhook } from '@payos/node';
import { env } from '../../utils/env';

/**
 * Three ways to pay, picked by which credentials are present. payOS is the real one; VNPay is
 * kept because it works and took long enough to get working that throwing it away would be
 * careless; MOCK opens a PENDING row and lets `confirm` mark it paid, which is what keeps a
 * developer machine with no merchant account runnable.
 *
 * Only `checkout` and the two callback handlers talk to a provider. Everything downstream of
 * `activatePro` is identical whichever one was used, so a real payment and a simulated one
 * leave the subscription in exactly the same state.
 */
export const PROVIDER = 'MOCK';
export const VNPAY_PROVIDER = 'VNPAY';
export const PAYOS_PROVIDER = 'PAYOS';

export type Provider = typeof PROVIDER | typeof VNPAY_PROVIDER | typeof PAYOS_PROVIDER;

/** payOS wins when both are configured — it is the one with a real merchant account behind it. */
export function activeProvider(): Provider {
  if (payosConfigured()) return PAYOS_PROVIDER;
  if (vnpayConfigured()) return VNPAY_PROVIDER;
  return PROVIDER;
}

const subscriptionSelect = {
  id: true,
  tier: true,
  status: true,
  cycle: true,
  startedAt: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
};

/** Everyone has a subscription row; FREE users simply have the default one. */
export async function ensureSubscription(userId: string) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: subscriptionSelect,
  });
}

/**
 * The effective tier, which is not always the stored one: a paid period that
 * has run out downgrades on read, so an expired card cannot keep Pro alive.
 */
export async function resolveTier(userId: string): Promise<PlanTier> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { tier: true, status: true, currentPeriodEnd: true },
  });
  if (!sub || sub.tier !== 'PRO') return 'FREE';
  if (sub.status === 'EXPIRED') return 'FREE';
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    await prisma.subscription.update({
      where: { userId },
      data: { tier: 'FREE', status: 'EXPIRED', cycle: null },
    });
    return 'FREE';
  }
  return 'PRO';
}

/** Subscription plus the numbers the UI needs to draw usage bars. */
export async function getMine(userId: string) {
  const tier = await resolveTier(userId);
  const sub = await ensureSubscription(userId);
  const limits = limitsFor(tier);

  const [ownedProjects, payments] = await Promise.all([
    prisma.projectMember.count({ where: { userId, role: 'OWNER' } }),
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        amount: true,
        currency: true,
        cycle: true,
        status: true,
        provider: true,
        providerRef: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    subscription: { ...sub, tier },
    limits,
    usage: {
      ownedProjects,
      maxOwnedProjects: limits.maxOwnedProjects,
    },
    payments,
  };
}

export function getPlans() {
  const provider = activeProvider();
  return {
    plans: [PLANS.FREE, PLANS.PRO],
    currency: 'VND',
    yearlySavingPercent: yearlySavingPercent(),
    /** The UI shows this so nobody mistakes the demo flow for a real charge. */
    simulated: provider === PROVIDER,
    provider,
  };
}

const paymentSelect = { providerRef: true, amount: true, cycle: true, createdAt: true };

/** Where payOS sends the browser back to. Its own URL, because this server has to read it. */
function payosReturnUrl(): string {
  return env('PAYOS_RETURN_URL') ?? 'http://localhost:5000/api/billing/payos/return';
}

/**
 * payOS wants a positive integer that is unique to the merchant for all time. Milliseconds
 * since the epoch with three random digits appended stays inside Number.MAX_SAFE_INTEGER
 * until the year 2255, and needs no round trip to the database to check for collisions.
 */
function newOrderCode(): number {
  return Date.now() * 1000 + crypto.randomInt(1000);
}

/**
 * Opens a pending payment. Nothing changes on the subscription until the provider confirms.
 *
 * With a gateway configured this returns a URL to send the browser to; without one, the
 * simulated reference, so the app still runs on a machine with no merchant credentials.
 */
export async function checkout(userId: string, input: CheckoutInput, ipAddr = '127.0.0.1') {
  const sub = await ensureSubscription(userId);
  const amount = priceFor(input.cycle);
  const provider = activeProvider();

  if (provider === PAYOS_PROVIDER) return checkoutPayos(userId, sub.id, input, amount);

  // An unpaid order for the same cycle is reused rather than stacked up. VNPay accepts a repeat
  // of a TxnRef that was never paid, so the customer just gets a fresh URL for the same order.
  const pending = await prisma.payment.findFirst({
    where: { userId, status: 'PENDING', cycle: input.cycle, provider },
    select: paymentSelect,
  });

  const payment =
    pending ??
    (await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        userId,
        amount,
        cycle: input.cycle,
        provider,
        // VNPay wants a short alphanumeric reference, unique per merchant.
        providerRef:
          provider === VNPAY_PROVIDER
            ? crypto.randomBytes(10).toString('hex')
            : `${PROVIDER}-${crypto.randomUUID()}`,
        status: 'PENDING',
      },
      select: paymentSelect,
    }));

  if (provider === PROVIDER) return { ...payment, provider, reused: !!pending, simulated: true };

  return {
    ...payment,
    provider,
    reused: !!pending,
    simulated: false,
    paymentUrl: buildPaymentUrl({
      txnRef: payment.providerRef,
      amount: payment.amount,
      orderInfo: `Nang cap SGAM Pro ${input.cycle === 'YEARLY' ? 'nam' : 'thang'}`,
      ipAddr,
    }),
  };
}

/**
 * A payOS order is never reused: `orderCode` is unique per merchant for ever, and asking for a
 * link with one that already exists is an error rather than a second link. Each checkout
 * therefore gets a fresh code, and anything the customer walked away from is closed first —
 * otherwise their payment history fills with PENDING rows nobody is ever going to pay.
 *
 * The abandoned links are left to lapse on their own rather than cancelled over the network:
 * `expiredAt` already closes them, and a provider call here would put checkout at the mercy of
 * a round trip that has nothing to do with the order being opened.
 */
async function checkoutPayos(userId: string, subscriptionId: string, input: CheckoutInput, amount: number) {
  await prisma.payment.updateMany({
    where: { userId, status: 'PENDING', provider: PAYOS_PROVIDER },
    // The enum has no CANCELLED; FAILED is the nearest it offers to "abandoned before paying".
    data: { status: PaymentStatus.FAILED },
  });

  const orderCode = newOrderCode();
  const payment = await prisma.payment.create({
    data: {
      subscriptionId,
      userId,
      amount,
      cycle: input.cycle,
      provider: PAYOS_PROVIDER,
      providerRef: String(orderCode),
      status: 'PENDING',
    },
    select: paymentSelect,
  });

  const url = payosReturnUrl();
  const link = await createPaymentLink({
    orderCode,
    amount,
    // payOS puts this in the bank transfer content and unlinked accounts get 9 characters, so
    // the cycle is not in here — orderCode is what identifies the order.
    description: 'SGAM Pro',
    returnUrl: url,
    cancelUrl: url,
  });

  return {
    ...payment,
    provider: PAYOS_PROVIDER,
    reused: false,
    simulated: false,
    paymentUrl: link.checkoutUrl,
    /** The VietQR payload, so the modal can draw the code instead of sending the browser away. */
    qrCode: link.qrCode,
  };
}

/** What VNPay expects back from an IPN call; any other body makes it retry. */
export interface IpnReply { RspCode: string; Message: string }

/**
 * The authoritative side of a VNPay payment. The browser return URL can be forged or simply
 * never opened, so the subscription is only ever activated from here.
 */
export async function handleVnpayIpn(query: Record<string, string>): Promise<IpnReply> {
  if (!vnpayConfigured()) return { RspCode: '99', Message: 'Payments are not configured' };
  if (!verifyCallback(query)) return { RspCode: '97', Message: 'Invalid signature' };

  const payment = await prisma.payment.findUnique({
    where: { providerRef: query.vnp_TxnRef ?? '' },
    select: { id: true, userId: true, status: true, cycle: true, amount: true },
  });
  if (!payment) return { RspCode: '01', Message: 'Order not found' };

  // VNPay sends the amount times 100. A mismatch means the order was tampered with in flight.
  if (String(payment.amount * 100) !== query.vnp_Amount) {
    return { RspCode: '04', Message: 'Invalid amount' };
  }
  if (payment.status === 'PAID') return { RspCode: '02', Message: 'Order already confirmed' };

  // Both fields must say 00. VNPay's own sample joins them with OR, which would bank a payment
  // the gateway itself recorded as failed; vnp_TransactionStatus is the one that describes what
  // actually happened at VNPay, and the docs mark both as required.
  if (query.vnp_ResponseCode !== '00' || query.vnp_TransactionStatus !== '00') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    // Still 00: the message was received and handled, so VNPay should stop resending it.
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  await activatePro(payment.userId, payment.id, payment.cycle);
  return { RspCode: '00', Message: 'Confirm Success' };
}

/** Read-only view for the page the customer lands back on; it never grants anything. */
export async function readVnpayReturn(query: Record<string, string>) {
  const valid = vnpayConfigured() && verifyCallback(query);
  const ref = query.vnp_TxnRef ?? '';
  const payment = valid && ref
    ? await prisma.payment.findUnique({ where: { providerRef: ref }, select: { status: true } })
    : null;
  return {
    valid,
    succeeded: valid && query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00',
    // The IPN usually lands first, but not always; the page says "processing" rather than lying.
    settled: payment?.status === 'PAID',
    providerRef: ref,
  };
}

/** What payOS expects back. Any non-2xx answer makes it redeliver the same transaction. */
export interface WebhookReply { success: boolean; message?: string }

/**
 * The authoritative side of a payOS payment, and the only thing that grants Pro.
 *
 * `verifyWebhook` throws unless the payload was signed with our checksum key, so nothing below
 * it is reachable from a forged request; the controller turns that throw into a 401.
 *
 * Everything it has definitively dealt with answers success, including a transaction that is
 * not ours. payOS redelivers on anything else, and its own registration check posts a sample
 * transaction that will never match a row here — refusing that would reject the webhook URL.
 */
export async function handlePayosWebhook(body: unknown): Promise<WebhookReply> {
  const data: WebhookData = await verifyWebhook(body as Webhook);

  const payment = await prisma.payment.findUnique({
    where: { providerRef: String(data.orderCode) },
    select: { id: true, userId: true, status: true, cycle: true, amount: true },
  });
  if (!payment) return { success: true, message: 'No such order' };
  if (payment.status === 'PAID') return { success: true, message: 'Already confirmed' };

  // payOS sends whole dong, the same unit the row is stored in, so these compare directly —
  // unlike VNPay, which multiplies by 100. A mismatch means the order was altered in flight.
  if (data.amount !== payment.amount) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    return { success: true, message: 'Amount mismatch' };
  }
  if (data.code !== '00') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: PaymentStatus.FAILED } });
    return { success: true, message: 'Payment did not succeed' };
  }

  await activatePro(payment.userId, payment.id, payment.cycle);
  return { success: true };
}

/**
 * Read-only view for the page the customer lands back on; it never grants anything. payOS does
 * not sign the return query, so anyone can type it — `settled` comes from our own row, which
 * only the webhook can have written.
 */
export async function readPayosReturn(query: Record<string, string>) {
  const ref = query.orderCode ?? '';
  const payment = ref
    ? await prisma.payment.findUnique({ where: { providerRef: ref }, select: { status: true } })
    : null;
  const cancelled = query.cancel === 'true' || query.status === 'CANCELLED';
  return {
    cancelled,
    succeeded: !cancelled && query.code === '00' && query.status === 'PAID',
    // The webhook usually lands first, but not always; the page says "processing" rather than lying.
    settled: payment?.status === 'PAID',
    providerRef: ref,
  };
}

/** Stands in for the gateway callback: marks the payment paid and starts Pro. */
export async function confirm(userId: string, input: ConfirmInput) {
  const payment = await prisma.payment.findUnique({
    where: { providerRef: input.providerRef },
    select: { id: true, userId: true, status: true, cycle: true, subscriptionId: true },
  });
  if (!payment || payment.userId !== userId) {
    throw Object.assign(new Error('Payment not found'), { status: 404 });
  }
  if (payment.status === 'PAID') {
    throw Object.assign(new Error('This payment was already confirmed'), { status: 409 });
  }
  return activatePro(userId, payment.id, payment.cycle);
}

/**
 * Marks the payment paid and starts or extends the Pro period. Shared by the mock confirm and
 * the VNPay IPN so a real payment and a simulated one land the subscription in the same state.
 */
async function activatePro(userId: string, paymentId: string, cycle: BillingCycle) {
  const now = new Date();
  // An active period is extended rather than truncated, so upgrading mid-cycle
  // never costs the buyer the days they already paid for.
  const current = await prisma.subscription.findUnique({
    where: { userId },
    select: { currentPeriodEnd: true, tier: true },
  });
  const base = current?.tier === 'PRO' && current.currentPeriodEnd && current.currentPeriodEnd > now
    ? current.currentPeriodEnd
    : now;

  const [, subscription] = await prisma.$transaction([
    prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paidAt: now },
    }),
    prisma.subscription.update({
      where: { userId },
      data: {
        tier: 'PRO',
        status: 'ACTIVE',
        cycle,
        startedAt: current?.tier === 'PRO' ? undefined : now,
        currentPeriodEnd: periodEndFrom(base, cycle),
        cancelAtPeriodEnd: false,
      },
      select: subscriptionSelect,
    }),
  ]);

  return subscription;
}

/** Cancels at the end of the paid period; access is not cut immediately. */
export async function cancel(userId: string) {
  const tier = await resolveTier(userId);
  if (tier !== 'PRO') throw Object.assign(new Error('No active Pro subscription'), { status: 400 });
  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true, status: 'CANCELLED' },
    select: subscriptionSelect,
  });
}

/** Undo a pending cancellation while the period is still running. */
export async function resume(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId }, select: { cancelAtPeriodEnd: true } });
  if (!sub?.cancelAtPeriodEnd) throw Object.assign(new Error('Nothing to resume'), { status: 400 });
  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: false, status: 'ACTIVE' },
    select: subscriptionSelect,
  });
}
