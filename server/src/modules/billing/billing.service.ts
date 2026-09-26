import crypto from 'crypto';
import { PlanTier, BillingCycle, PaymentStatus } from '@prisma/client';
import prisma from '../../config/db';
import { PLANS, priceFor, periodEndFrom, limitsFor, yearlySavingPercent } from '../../constants/plans';
import { CheckoutInput, ConfirmInput } from './billing.schema';
import { buildPaymentUrl, verifyCallback, vnpayConfigured } from '../../config/vnpay';

/**
 * Real payments go through VNPay when it is configured; otherwise `checkout` opens a PENDING
 * row and `confirm` marks it paid, which is what keeps local development runnable without
 * merchant credentials. Only `checkout` and the IPN handler talk to the provider.
 */
export const PROVIDER = 'MOCK';
export const VNPAY_PROVIDER = 'VNPAY';

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
  return {
    plans: [PLANS.FREE, PLANS.PRO],
    currency: 'VND',
    yearlySavingPercent: yearlySavingPercent(),
    /** The UI shows this so nobody mistakes the demo flow for a real charge. */
    simulated: true,
    provider: PROVIDER,
  };
}

/**
 * Opens a pending payment. Nothing changes on the subscription until the gateway confirms.
 *
 * With VNPay configured this returns a URL to send the browser to; without it, the old
 * simulated reference, so the app still runs on a machine with no merchant credentials.
 */
export async function checkout(userId: string, input: CheckoutInput, ipAddr = '127.0.0.1') {
  const sub = await ensureSubscription(userId);
  const amount = priceFor(input.cycle);
  const live = vnpayConfigured();

  // An unpaid order for the same cycle is reused rather than stacked up. VNPay accepts a repeat
  // of a TxnRef that was never paid, so the customer just gets a fresh URL for the same order.
  const pending = await prisma.payment.findFirst({
    where: { userId, status: 'PENDING', cycle: input.cycle, provider: live ? VNPAY_PROVIDER : PROVIDER },
    select: { providerRef: true, amount: true, cycle: true, createdAt: true },
  });

  const payment =
    pending ??
    (await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        userId,
        amount,
        cycle: input.cycle,
        provider: live ? VNPAY_PROVIDER : PROVIDER,
        // VNPay wants a short alphanumeric reference, unique per merchant.
        providerRef: live ? crypto.randomBytes(10).toString('hex') : `${PROVIDER}-${crypto.randomUUID()}`,
        status: 'PENDING',
      },
      select: { providerRef: true, amount: true, cycle: true, createdAt: true },
    }));

  if (!live) return { ...payment, reused: !!pending, simulated: true };

  return {
    ...payment,
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
