import api from './axiosClient';

export type PlanTier = 'FREE' | 'PRO';
export type BillingCycle = 'MONTHLY' | 'YEARLY';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface PlanLimits {
  maxOwnedProjects: number | null;
  maxMembersPerProject: number | null;
  maxUploadMb: number;
  reports: boolean;
  gantt: boolean;
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  features: string[];
}

export interface Subscription {
  id: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  cycle: BillingCycle | null;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  cycle: BillingCycle;
  status: PaymentStatus;
  provider: string;
  providerRef: string;
  paidAt: string | null;
  createdAt: string;
}

export interface BillingState {
  subscription: Subscription;
  limits: PlanLimits;
  usage: { ownedProjects: number; maxOwnedProjects: number | null };
  payments: Payment[];
}

export interface PlanCatalogue {
  plans: PlanDefinition[];
  currency: string;
  yearlySavingPercent: number;
  /** True while payments are simulated rather than charged by a real gateway. */
  simulated: boolean;
  provider: string;
}

export interface CheckoutSession {
  providerRef: string;
  amount: number;
  cycle: BillingCycle;
  createdAt: string;
  reused: boolean;
  simulated: boolean;
  /** Present only when a real gateway is configured; the browser is sent here to pay. */
  paymentUrl?: string;
}

export const billingApi = {
  plans: async (): Promise<PlanCatalogue> => (await api.get('/billing/plans')).data.data,
  me: async (): Promise<BillingState> => (await api.get('/billing/me')).data.data,
  checkout: async (cycle: BillingCycle): Promise<CheckoutSession> =>
    (await api.post('/billing/checkout', { cycle })).data.data,
  confirm: async (providerRef: string): Promise<Subscription> =>
    (await api.post('/billing/confirm', { providerRef })).data.data,
  cancel: async (): Promise<Subscription> => (await api.post('/billing/cancel')).data.data,
  resume: async (): Promise<Subscription> => (await api.post('/billing/resume')).data.data,
};

/** 49000 -> "49.000 ₫" */
export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}
