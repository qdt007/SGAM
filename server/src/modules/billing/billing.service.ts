import crypto from 'crypto';
import { PlanTier, BillingCycle, PaymentStatus } from '@prisma/client';
import prisma from '../../config/db';
import { PLANS, priceFor, periodEndFrom, limitsFor, yearlySavingPercent } from '../../constants/plans';
import { CheckoutInput, ConfirmInput } from './billing.schema';

/**
 * Payments are simulated. There is no gateway integration and no money moves:
 * `checkout` records a PENDING payment and returns a reference, `confirm`
 * marks it PAID and activates the period. Swapping in a real provider means
 * replacing those two functions and verifying the provider's callback
 * signature — nothing else in the app talks to the provider.
 */
export const PROVIDER = 'MOCK';

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

/** Opens a pending payment. Nothing changes on the subscription until confirm. */
export async function checkout(userId: string, input: CheckoutInput) {
  const sub = await ensureSubscription(userId);
  const amount = priceFor(input.cycle);

  const pending = await prisma.payment.findFirst({
    where: { userId, status: 'PENDING', cycle: input.cycle },
    select: { providerRef: true, amount: true, cycle: true, createdAt: true },
  });
  if (pending) return { ...pending, reused: true, simulated: true };

  const payment = await prisma.payment.create({
    data: {
      subscriptionId: sub.id,
      userId,
      amount,
      cycle: input.cycle,
      provider: PROVIDER,
      providerRef: `${PROVIDER}-${crypto.randomUUID()}`,
      status: 'PENDING',
    },
    select: { providerRef: true, amount: true, cycle: true, createdAt: true },
  });
  return { ...payment, reused: false, simulated: true };
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
      where: { id: payment.id },
      data: { status: PaymentStatus.PAID, paidAt: now },
    }),
    prisma.subscription.update({
      where: { userId },
      data: {
        tier: 'PRO',
        status: 'ACTIVE',
        cycle: payment.cycle,
        startedAt: current?.tier === 'PRO' ? undefined : now,
        currentPeriodEnd: periodEndFrom(base, payment.cycle),
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
