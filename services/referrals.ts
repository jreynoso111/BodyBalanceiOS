import { supabase } from '@/services/supabase';

export type InviteSummary = {
  inviteCode: string;
  referralCount: number;
  referralsUntilNextReward: number;
  nextRewardAtUses: number;
  rewardCyclesAwarded: number;
  premiumReferralExpiresAt: string | null;
  referredByUserId: string | null;
  referredByCode: string | null;
  hasUnseenReward: boolean;
  latestRewardAt: string | null;
};

export type ReferralRewardPayload = {
  rewardMonths: number;
  referralCount: number;
  premiumExpiresAt: string | null;
};

export type PendingPremiumCelebration = {
  source: 'referral' | 'purchase' | 'admin';
  grantedAt: string | null;
  premiumReferralExpiresAt: string | null;
  referralCount: number;
  rewardMonths: number;
  hasPending: boolean;
};

export function formatReferralExpiry(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export async function getMyInviteSummary(): Promise<{
  data: InviteSummary | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_my_invite_summary');
  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { data: null, error: null };
  }

  return {
    data: {
      inviteCode: String(row.invite_code || '').trim(),
      referralCount: Number(row.referral_count || 0),
      referralsUntilNextReward: Number(row.referrals_until_next_reward || 3),
      nextRewardAtUses: Number(row.next_reward_at_uses || 3),
      rewardCyclesAwarded: Number(row.reward_cycles_awarded || 0),
      premiumReferralExpiresAt: row.premium_referral_expires_at || null,
      referredByUserId: row.referred_by_user_id || null,
      referredByCode: row.referred_by_code || null,
      hasUnseenReward: Boolean(row.has_unseen_reward),
      latestRewardAt: row.latest_reward_at || null,
    },
    error: null,
  };
}

export async function applyInvitationCode(code: string): Promise<{
  data: ReferralRewardPayload | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('apply_invitation_code', {
    p_code: code,
  });

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const payload = Array.isArray(data) ? data[0] : data;

  return {
    data: payload
      ? {
          rewardMonths: Number(payload.reward_months || 0),
          referralCount: Number(payload.referral_count || 0),
          premiumExpiresAt: payload.premium_expires_at || null,
        }
      : null,
    error: null,
  };
}

export async function markLatestReferralRewardSeen(): Promise<Error | null> {
  const { error } = await supabase.rpc('mark_latest_referral_reward_seen');
  return error ? new Error(error.message) : null;
}

export async function getMyPendingPremiumCelebration(): Promise<{
  data: PendingPremiumCelebration | null;
  error: Error | null;
}> {
  const { data, error } = await supabase.rpc('get_my_pending_premium_celebration');
  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { data: null, error: null };
  }

  const source = String(row.source || '').trim();
  if (source !== 'referral' && source !== 'purchase' && source !== 'admin') {
    return { data: null, error: null };
  }

  return {
    data: {
      source,
      grantedAt: row.granted_at || null,
      premiumReferralExpiresAt: row.premium_referral_expires_at || null,
      referralCount: Number(row.referral_count || 0),
      rewardMonths: Number(row.reward_months || 0),
      hasPending: Boolean(row.has_pending),
    },
    error: null,
  };
}

export async function markPremiumCelebrationSeen(): Promise<Error | null> {
  const { error } = await supabase.rpc('mark_premium_celebration_seen');
  return error ? new Error(error.message) : null;
}
