import { useQuery } from '@tanstack/react-query';
import { billingApi, PlanLimits } from '../api/billingApi';

export const planKeys = {
  me: ['billing', 'me'] as const,
  plans: ['billing', 'plans'] as const,
};

const FREE_FALLBACK: PlanLimits = {
  maxOwnedProjects: 3,
  maxMembersPerProject: 5,
  maxUploadMb: 5,
  reports: false,
  gantt: false,
};

/**
 * What the current user's plan allows. The server enforces the same rules, so
 * this only decides what the UI offers — never what it is allowed to do.
 */
export function usePlan() {
  const { data, isLoading } = useQuery({
    queryKey: planKeys.me,
    queryFn: billingApi.me,
    staleTime: 60_000,
  });

  const limits = data?.limits ?? FREE_FALLBACK;
  const subscription = data?.subscription;
  const isPro = subscription?.tier === 'PRO';

  return {
    isLoading,
    isPro,
    tier: subscription?.tier ?? 'FREE',
    subscription,
    limits,
    usage: data?.usage,
    payments: data?.payments ?? [],
    canUseReports: limits.reports,
    canUseGantt: limits.gantt,
    /** null means unlimited. */
    projectsLeft:
      limits.maxOwnedProjects === null
        ? null
        : Math.max(0, limits.maxOwnedProjects - (data?.usage.ownedProjects ?? 0)),
  };
}

/** Reads the 402 body the plan middleware returns, for inline upgrade prompts. */
export function planLimitFrom(error: unknown): { message: string; feature?: string } | null {
  const res = (error as { response?: { status?: number; data?: Record<string, unknown> } })?.response;
  if (res?.status !== 402 || res?.data?.code !== 'PLAN_LIMIT') return null;
  return {
    message: String(res.data.message ?? 'This is part of the Pro plan'),
    feature: res.data.feature as string | undefined,
  };
}
