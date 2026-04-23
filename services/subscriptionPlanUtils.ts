export type PlanTier = 'free' | 'premium';

export function getReferralPremiumEndsAt(premiumReferralExpiresAt?: string | null) {
  if (!premiumReferralExpiresAt) return null;
  const expiresAt = new Date(premiumReferralExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return null;
  return expiresAt;
}

export function hasReferralPremiumAccessAt(premiumReferralExpiresAt?: string | null, now = Date.now()) {
  const expiresAt = getReferralPremiumEndsAt(premiumReferralExpiresAt);
  if (!expiresAt) return false;
  return expiresAt.getTime() > now;
}

export function getReferralPremiumDaysRemaining(premiumReferralExpiresAt?: string | null, now = Date.now()) {
  const expiresAt = getReferralPremiumEndsAt(premiumReferralExpiresAt);
  if (!expiresAt) return 0;
  const remainingMs = expiresAt.getTime() - now;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
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
