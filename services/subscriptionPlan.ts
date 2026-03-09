import { supabase } from '@/services/supabase';

export type PlanTier = 'free' | 'premium';

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
  if (!premiumReferralExpiresAt) return false;
  const expiresAt = new Date(premiumReferralExpiresAt);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > Date.now();
}

export function normalizePlanTier(value?: string | null, premiumReferralExpiresAt?: string | null): PlanTier {
  if (String(value || '').toLowerCase().trim() === 'premium') {
    return 'premium';
  }

  return hasReferralPremiumAccess(premiumReferralExpiresAt) ? 'premium' : 'free';
}

export function getPlanLabel(plan: PlanTier) {
  return plan === 'premium' ? 'Premium' : 'Free';
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
