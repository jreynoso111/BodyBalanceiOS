import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { AppLanguage, getDeviceLanguage } from '@/constants/i18n';
import { PlanTier } from '@/services/subscriptionPlan';

interface AuthState {
    session: Session | null;
    user: User | null;
    role: string | null;
    planTier: PlanTier;
    language: AppLanguage;
    initialized: boolean;
    referralReward: {
        source: 'referral' | 'purchase' | 'admin';
        rewardMonths: number;
        referralCount: number;
        premiumExpiresAt: string | null;
    } | null;
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
    setRole: (role: string | null) => void;
    setPlanTier: (planTier: PlanTier) => void;
    setLanguage: (language: AppLanguage) => void;
    setInitialized: (initialized: boolean) => void;
    showReferralReward: (reward: {
        source: 'referral' | 'purchase' | 'admin';
        rewardMonths: number;
        referralCount: number;
        premiumExpiresAt: string | null;
    }) => void;
    clearReferralReward: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    user: null,
    role: null,
    planTier: 'free',
    language: getDeviceLanguage(),
    initialized: false,
    referralReward: null,
    setSession: (session) => set({ session }),
    setUser: (user) => set({ user }),
    setRole: (role) => set({ role }),
    setPlanTier: (planTier) => set({ planTier }),
    setLanguage: (language) => set({ language }),
    setInitialized: (initialized) => set({ initialized }),
    showReferralReward: (reward) => set({ referralReward: reward }),
    clearReferralReward: () => set({ referralReward: null }),
}));
