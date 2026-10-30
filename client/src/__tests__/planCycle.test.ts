import { describe, it, expect } from 'vitest';
import type { BillingCycle, PlanTier, Subscription } from '../api/billingApi';

/**
 * Which plan card is "Đang dùng", and which cycle the switch opens on.
 *
 * These two decisions were wrong together and reinforced each other: the switch opened on yearly
 * regardless of what the viewer had bought, and "Đang dùng" matched on tier alone. Somebody who
 * paid 49.000đ for a month opened the page and saw 499.000đ / năm badged as their current plan —
 * a price they had never agreed to, next to a disabled button telling them it was already theirs.
 *
 * Mirrors the expressions in BillingSection. Pure logic, so it is worth pinning.
 */

/** What the cycle switch shows: their own, until they touch it. */
const shownCycle = (picked: BillingCycle | null, sub?: Pick<Subscription, 'cycle'>): BillingCycle =>
  picked ?? sub?.cycle ?? 'YEARLY';

/** The card is theirs only when the tier *and* the cycle line up. Free has no cycle. */
const isCurrent = (card: PlanTier, tier: PlanTier, subCycle: BillingCycle | null, shown: BillingCycle) =>
  card === tier && (card === 'FREE' || subCycle === shown);

/** They are already on Pro, just paying for the other cycle. */
const isOtherCycle = (card: PlanTier, tier: PlanTier, subCycle: BillingCycle | null, shown: BillingCycle) =>
  card === 'PRO' && tier === 'PRO' && subCycle !== shown;

describe('which cycle the switch opens on', () => {
  it('opens on the cycle the subscriber actually pays for', () => {
    expect(shownCycle(null, { cycle: 'MONTHLY' })).toBe('MONTHLY');
    expect(shownCycle(null, { cycle: 'YEARLY' })).toBe('YEARLY');
  });

  it('falls back to yearly for someone with no subscription to read', () => {
    expect(shownCycle(null, undefined)).toBe('YEARLY');
    expect(shownCycle(null, { cycle: null })).toBe('YEARLY');
  });

  it('lets a deliberate choice override the subscription', () => {
    expect(shownCycle('YEARLY', { cycle: 'MONTHLY' })).toBe('YEARLY');
    expect(shownCycle('MONTHLY', { cycle: 'YEARLY' })).toBe('MONTHLY');
  });
});

describe('which card reads "Đang dùng"', () => {
  it('does not badge the yearly card for a monthly subscriber', () => {
    // The original bug, in one line.
    expect(isCurrent('PRO', 'PRO', 'MONTHLY', 'YEARLY')).toBe(false);
  });

  it('badges the card that matches both tier and cycle', () => {
    expect(isCurrent('PRO', 'PRO', 'MONTHLY', 'MONTHLY')).toBe(true);
    expect(isCurrent('PRO', 'PRO', 'YEARLY', 'YEARLY')).toBe(true);
  });

  it('badges Free regardless of the switch, since Free has no cycle', () => {
    expect(isCurrent('FREE', 'FREE', null, 'YEARLY')).toBe(true);
    expect(isCurrent('FREE', 'FREE', null, 'MONTHLY')).toBe(true);
  });

  it('never badges Pro for someone on Free', () => {
    expect(isCurrent('PRO', 'FREE', null, 'MONTHLY')).toBe(false);
    expect(isCurrent('PRO', 'FREE', null, 'YEARLY')).toBe(false);
  });
});

describe('what the button offers', () => {
  it('offers a switch, not an upgrade, to a Pro viewer on the other cycle', () => {
    // "Nâng cấp lên Pro" to somebody already on Pro is nonsense — there is nothing above it.
    expect(isOtherCycle('PRO', 'PRO', 'MONTHLY', 'YEARLY')).toBe(true);
    expect(isOtherCycle('PRO', 'PRO', 'YEARLY', 'MONTHLY')).toBe(true);
  });

  it('is not a switch when the card is already theirs', () => {
    expect(isOtherCycle('PRO', 'PRO', 'MONTHLY', 'MONTHLY')).toBe(false);
  });

  it('is an upgrade, not a switch, for someone on Free', () => {
    expect(isOtherCycle('PRO', 'FREE', null, 'YEARLY')).toBe(false);
  });

  it('never claims both at once', () => {
    for (const subCycle of ['MONTHLY', 'YEARLY'] as BillingCycle[]) {
      for (const shown of ['MONTHLY', 'YEARLY'] as BillingCycle[]) {
        const both = isCurrent('PRO', 'PRO', subCycle, shown) && isOtherCycle('PRO', 'PRO', subCycle, shown);
        expect(both, `subCycle=${subCycle} shown=${shown}`).toBe(false);
      }
    }
  });
});
