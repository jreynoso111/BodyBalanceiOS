import { supabase } from '@/services/supabase';
import { hasReferralPremiumAccessAt, normalizePlanTierValue, type PlanTier } from '@/services/subscriptionPlanUtils';

export type { PlanTier } from '@/services/subscriptionPlanUtils';
export type MembershipStatus = 'free' | 'trial' | 'premium';
export const PREMIUM_TRIAL_DAYS = 21;
const PREMIUM_TRIAL_MS = PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000;

export const PLAN_LIMITS = {
  free: {
    linkedFriends: 5,
    activeRecords: 25,
  },
  premium: {
    linkedFriends: Infinity,
    activeRecords: Infinity,
  },
} as const;

export function hasReferralPremiumAccess(premiumReferralExpiresAt?: string | null) {
  return hasReferralPremiumAccessAt(premiumReferralExpiresAt);
}

export function normalizePlanTier(value?: string | null, premiumReferralExpiresAt?: string | null): PlanTier {
  return normalizePlanTierValue(value, premiumReferralExpiresAt);
}

export function getPremiumTrialEndsAt(trialStartedAt?: string | null) {
  if (!trialStartedAt) return null;
  const startsAt = new Date(trialStartedAt);
  if (Number.isNaN(startsAt.getTime())) return null;
  return new Date(startsAt.getTime() + PREMIUM_TRIAL_MS);
}

export function hasPremiumTrialAccess(trialStartedAt?: string | null, now = Date.now()) {
  const endsAt = getPremiumTrialEndsAt(trialStartedAt);
  if (!endsAt) return false;
  return endsAt.getTime() > now;
}

export function getPremiumTrialDaysRemaining(trialStartedAt?: string | null, now = Date.now()) {
  const endsAt = getPremiumTrialEndsAt(trialStartedAt);
  if (!endsAt) return 0;
  const remainingMs = endsAt.getTime() - now;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
}

export function getMembershipStatus(plan: PlanTier, options?: { trialStartedAt?: string | null }): MembershipStatus {
  if (plan === 'premium') return 'premium';
  return hasPremiumTrialAccess(options?.trialStartedAt) ? 'trial' : 'free';
}

export function hasPremiumAccess(plan: PlanTier, options?: { trialStartedAt?: string | null }) {
  return getMembershipStatus(plan, options) !== 'free';
}

export function getPlanLabel(plan: PlanTier, options?: { trialStartedAt?: string | null }) {
  const status = getMembershipStatus(plan, options);
  if (status === 'premium') return 'Premium';
  if (status === 'trial') return 'Trial';
  return 'Free';
}

export async function fetchPlanTier(userId: string): Promise<{
  plan: PlanTier;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan_tier, premium_referral_expires_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return { plan: 'free', error: new Error(error.message) };
  }

  return {
    plan: normalizePlanTier((data as any)?.plan_tier, (data as any)?.premium_referral_expires_at),
    error: null,
  };
}

export async function countLinkedFriends(userId: string): Promise<{
  count: number;
  error: Error | null;
}> {
  const { count, error } = await supabase
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('link_status', 'accepted')
    .not('target_user_id', 'is', null)
    .is('deleted_at', null);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }

  return { count: count || 0, error: null };
}

export async function countActiveRecords(userId: string): Promise<{
  count: number;
  error: Error | null;
}> {
  const { count, error } = await supabase
    .from('loans')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null)
    .in('status', ['active', 'partial', 'overdue']);

  if (error) {
    return { count: 0, error: new Error(error.message) };
  }

  return { count: count || 0, error: null };
}
