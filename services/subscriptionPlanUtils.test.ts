import {
  getReferralPremiumDaysRemaining,
  getReferralPremiumEndsAt,
  hasReferralPremiumAccessAt,
  normalizePlanTierValue,
} from '@/services/subscriptionPlanUtils';

describe('subscription plan normalization', () => {
  const now = Date.parse('2026-03-13T12:00:00.000Z');

  it('keeps explicit premium regardless of referral expiry', () => {
    expect(normalizePlanTierValue('premium', null, now)).toBe('premium');
    expect(normalizePlanTierValue(' Premium ', '2020-01-01T00:00:00.000Z', now)).toBe('premium');
  });

  it('promotes free users with active referral premium', () => {
    expect(hasReferralPremiumAccessAt('2026-03-20T00:00:00.000Z', now)).toBe(true);
    expect(getReferralPremiumEndsAt('2026-03-20T00:00:00.000Z')?.toISOString()).toBe('2026-03-20T00:00:00.000Z');
    expect(getReferralPremiumDaysRemaining('2026-03-20T00:00:00.000Z', now)).toBe(7);
    expect(normalizePlanTierValue('free', '2026-03-20T00:00:00.000Z', now)).toBe('premium');
  });

  it('falls back to free when referral premium is missing, invalid, or expired', () => {
    expect(hasReferralPremiumAccessAt(null, now)).toBe(false);
    expect(hasReferralPremiumAccessAt('not-a-date', now)).toBe(false);
    expect(hasReferralPremiumAccessAt('2026-03-01T00:00:00.000Z', now)).toBe(false);
    expect(getReferralPremiumEndsAt('not-a-date')).toBeNull();
    expect(getReferralPremiumDaysRemaining('2026-03-01T00:00:00.000Z', now)).toBe(0);
    expect(normalizePlanTierValue('free', null, now)).toBe('free');
  });
});
