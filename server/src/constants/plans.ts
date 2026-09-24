import { PlanTier, BillingCycle } from '@prisma/client';

/**
 * The single source of truth for what each plan costs and allows.
 * Both the enforcement middleware and the pricing page read from here, so a
 * limit can never say one thing in the UI and another in the API.
 *
 * Amounts are whole dong — VND has no minor unit.
 */

export interface PlanLimits {
  /** Projects a user may own. null = unlimited. */
  maxOwnedProjects: number | null;
  /** Members per project, including the owner. null = unlimited. */
  maxMembersPerProject: number | null;
  /** Largest single upload. */
  maxUploadMb: number;
  /** Burndown / workload reports. */
  reports: boolean;
  /** Gantt timeline and task dependencies. */
  gantt: boolean;
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  /** Marketing bullets, shown in order on the pricing page. */
  features: string[];
}

export const PLANS: Record<PlanTier, PlanDefinition> = {
  FREE: {
    tier: 'FREE',
    name: 'Free',
    tagline: 'Đủ cho một nhóm bài tập',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxOwnedProjects: 3,
      maxMembersPerProject: 5,
      maxUploadMb: 5,
      reports: false,
      gantt: false,
    },
    features: [
      'Tối đa 3 project',
      'Tối đa 5 thành viên mỗi project',
      'Bảng Kanban kéo thả',
      'Bình luận và @mention',
      'Bấm giờ làm việc',
      'Đính kèm file tối đa 5MB',
      'Thông báo realtime',
    ],
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    tagline: 'Cho nhóm chạy nhiều dự án cùng lúc',
    priceMonthly: 49000,
    priceYearly: 299000,
    limits: {
      maxOwnedProjects: null,
      maxMembersPerProject: null,
      maxUploadMb: 10,
      reports: true,
      gantt: true,
    },
    features: [
      'Project và thành viên không giới hạn',
      'Báo cáo burndown và workload',
      'Gantt timeline và phụ thuộc công việc',
      'Đính kèm file tối đa 10MB',
      'Toàn bộ tính năng của gói Free',
    ],
  },
};

export const YEARLY_MONTHS = 12;

/** How much a year saves against paying monthly, as a whole percent. */
export function yearlySavingPercent(): number {
  const { priceMonthly, priceYearly } = PLANS.PRO;
  const full = priceMonthly * YEARLY_MONTHS;
  return Math.round(((full - priceYearly) / full) * 100);
}

export function priceFor(cycle: BillingCycle): number {
  return cycle === 'YEARLY' ? PLANS.PRO.priceYearly : PLANS.PRO.priceMonthly;
}

/** Period length for a paid cycle, from the moment it is activated. */
export function periodEndFrom(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start);
  if (cycle === 'YEARLY') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}

export function limitsFor(tier: PlanTier): PlanLimits {
  return PLANS[tier].limits;
}
