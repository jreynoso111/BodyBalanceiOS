export type PlanTier = 'free' | 'premium';

export function hasReferralPremiumAccessAt(premiumReferralExpiresAt?: string | null, now = Date.now()) {
  if (!premiumReferralExpiresAt) return false;
  const expiresAt = new Date(premiumReferralExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > now;
}

export function normalizePlanTierValue(
  value?: string | null,
  premiumReferralExpiresAt?: string | null,
  now = Date.now()
): PlanTier {
  if (String(value || '').toLowerCase().trim() === 'premium') {
    return 'premium';
  }

  return hasReferralPremiumAccessAt(premiumReferralExpiresAt, now) ? 'premium' : 'free';
}
