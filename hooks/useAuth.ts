import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { clearPersistedAuthState, supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceLanguage, normalizeLanguage } from '@/constants/i18n';
import { normalizePlanTier } from '@/services/subscriptionPlan';
import { showSharedUpdateNotification } from '@/services/notificationService';
import { getMyInviteSummary, getMyPendingPremiumCelebration } from '@/services/referrals';

const LAST_PROTECTED_PATH_KEY = 'last_protected_path';
const NON_RECOVERABLE_PATH_PREFIXES = [
    '/admin',
    '/(admin)',
    '/new-contact',
    '/new-loan',
    '/payment',
    '/register-payment',
    '/profile',
];
const PUBLIC_PATH_PREFIXES = [
    '/contact',
    '/faq',
    '/help-support',
    '/help/',
    '/privacy',
    '/terms',
];
const isMissingDefaultLanguageColumn = (message?: string) =>
    String(message || '').toLowerCase().includes('default_language');
const isInvalidRefreshTokenError = (message?: string) => {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('invalid refresh token') || normalized.includes('refresh token not found');
};
const normalizeRole = (role?: string | null) => {
    const normalized = String(role || '').toLowerCase().trim();
    if (normalized === 'administrator') return 'admin';
    if (normalized) return normalized;
    return 'user';
};

export const useAuth = () => {
    const { setSession, setUser, setRole, setPlanTier, setLanguage, setInitialized, session, initialized } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();
    const segments = useSegments();
    const profileSyncInFlightRef = useRef(false);
    const profileSyncQueuedRef = useRef(false);

    const resetLocalAuthState = async () => {
        await AsyncStorage.removeItem(LAST_PROTECTED_PATH_KEY);
        await clearPersistedAuthState();
        setSession(null);
        setUser(null);
        setRole(null);
        setPlanTier('free');
        setLanguage(getDeviceLanguage());
    };

    const isRecoverableProtectedPath = (value?: string | null) => {
        if (!value) return false;
        return !NON_RECOVERABLE_PATH_PREFIXES.some((prefix) => value.startsWith(prefix));
    };

    const isPublicPath = (value?: string | null) => {
        if (!value) return false;
        const normalized = value.toLowerCase();
        return PUBLIC_PATH_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(prefix));
    };

    const fetchProfileMeta = async (userId: string) => {
        let { data, error } = await supabase
            .from('profiles')
            .select('role, default_language, plan_tier, premium_referral_expires_at')
            .eq('id', userId)
            .single();

        if (error && isMissingDefaultLanguageColumn(error.message)) {
            const fallback = await supabase
                .from('profiles')
                .select('role, plan_tier, premium_referral_expires_at')
                .eq('id', userId)
                .single();
            data = fallback.data as any;
            error = fallback.error as any;
        }

        const normalizedRole = normalizeRole((data as any)?.role);
        const planTier = normalizePlanTier((data as any)?.plan_tier, (data as any)?.premium_referral_expires_at);
        const language = normalizeLanguage((data as any)?.default_language, getDeviceLanguage());

        return { normalizedRole, planTier, language };
    };

    const hydratePendingReferralReward = async () => {
        const pendingPremiumCelebration = await getMyPendingPremiumCelebration();
        if (pendingPremiumCelebration.data?.hasPending) {
            useAuthStore.getState().showReferralReward({
                source: pendingPremiumCelebration.data.source,
                rewardMonths: pendingPremiumCelebration.data.rewardMonths || 1,
                referralCount: pendingPremiumCelebration.data.referralCount,
                premiumExpiresAt: pendingPremiumCelebration.data.premiumReferralExpiresAt,
            });
            setPlanTier('premium');
            return;
        }

        const { data } = await getMyInviteSummary();
        if (!data?.hasUnseenReward) return;
        useAuthStore.getState().showReferralReward({
            source: 'referral',
            rewardMonths: 1,
            referralCount: data.referralCount,
            premiumExpiresAt: data.premiumReferralExpiresAt,
        });
        setPlanTier('premium');
    };

    const syncProfileState = async (userId: string) => {
        if (profileSyncInFlightRef.current) {
            profileSyncQueuedRef.current = true;
            return;
        }

        profileSyncInFlightRef.current = true;

        try {
            do {
                profileSyncQueuedRef.current = false;

                const { normalizedRole, planTier, language } = await fetchProfileMeta(userId);
                setRole(normalizedRole);
                setPlanTier(planTier);
                setLanguage(language);
                await hydratePendingReferralReward();
            } while (profileSyncQueuedRef.current);
        } finally {
            profileSyncInFlightRef.current = false;
        }
    };

    useEffect(() => {
        // 1. Initial session check
        const checkSession = async () => {
            try {
                const {
                    data: { session },
                    error,
                } = await supabase.auth.getSession();

                if (error && isInvalidRefreshTokenError(error.message)) {
                    console.warn('clearing invalid persisted auth session:', error.message);
                    await resetLocalAuthState();
                    return;
                }

                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user?.id) {
                    await syncProfileState(session.user.id);
                } else {
                    setRole(null);
                    setPlanTier('free');
                    setLanguage(getDeviceLanguage());
                }
            } catch (error: any) {
                if (isInvalidRefreshTokenError(error?.message)) {
                    console.warn('clearing invalid persisted auth session:', error.message);
                    await resetLocalAuthState();
                    return;
                }
                console.error('auth session initialization failed:', error?.message || error);
                setRole(null);
                setPlanTier('free');
                setLanguage(getDeviceLanguage());
            } finally {
                setInitialized(true);
            }
        };

        checkSession();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setSession(session);
                setUser(session?.user ?? null);

                if (session?.user?.id) {
                    await syncProfileState(session.user.id);
                } else {
                    setRole(null);
                    setPlanTier('free');
                    setLanguage(getDeviceLanguage());
                    // Prevent stale protected-route recovery after a sign-out.
                    await AsyncStorage.removeItem(LAST_PROTECTED_PATH_KEY);
                }

                if (event === 'SIGNED_OUT') {
                    router.replace('/');
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!initialized || !session?.user?.id) return;
        void syncProfileState(session.user.id);
    }, [initialized, pathname, session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel(`shared-updates:${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'p2p_requests',
                    filter: `to_user_id=eq.${session.user.id}`,
                },
                (payload) => {
                    const next = payload.new as any;
                    void showSharedUpdateNotification({
                        type: String(next?.type || 'shared_update'),
                        fromName: next?.request_payload?.sender_name || null,
                        message: next?.message || null,
                    });

                    if (String(next?.type || '') === 'referral_reward') {
                        useAuthStore.getState().showReferralReward({
                            source: 'referral',
                            rewardMonths: Number(next?.request_payload?.reward_months || 1),
                            referralCount: Number(next?.request_payload?.referral_count || 0),
                            premiumExpiresAt: next?.request_payload?.premium_expires_at || null,
                        });
                        setPlanTier('premium');
                    }
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session?.user?.id) return;

        const channel = supabase
            .channel(`profile-premium:${session.user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${session.user.id}`,
                },
                () => {
                    void syncProfileState(session.user.id);
                }
            )
            .subscribe();

        return () => {
            void supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    useEffect(() => {
        if (!initialized) return;
        if (!pathname) return;

        const normalizedPath = pathname.toLowerCase();
        const topSegment = segments[0];
        const inTabsRoute = topSegment === '(tabs)';
        const inAdminRoute = topSegment === '(admin)' || topSegment === 'admin';
        const inAuthRoute =
            topSegment === '(auth)' ||
            normalizedPath.startsWith('/auth/callback') ||
            normalizedPath.startsWith('/login') ||
            normalizedPath.startsWith('/register') ||
            normalizedPath.startsWith('/forgot-password') ||
            normalizedPath.startsWith('/reset-password');
        const isLandingPage = normalizedPath === '/' && !inTabsRoute && !inAdminRoute;
        const isResetPassword = normalizedPath.startsWith('/reset-password');
        const isPublicMarketingRoute = isPublicPath(normalizedPath);
        const isEphemeralFormRoute =
            normalizedPath.startsWith('/new-contact') ||
            normalizedPath.startsWith('/new-loan') ||
            normalizedPath.startsWith('/payment') ||
            normalizedPath.startsWith('/register-payment');

        const handleRouting = async () => {
            if (session && !inAuthRoute && !isLandingPage && !isPublicMarketingRoute && !isEphemeralFormRoute) {
                // Keep track of last protected route for refresh/reload recovery.
                const pathToPersist = isRecoverableProtectedPath(pathname) ? pathname : '/(tabs)';
                await AsyncStorage.setItem(LAST_PROTECTED_PATH_KEY, pathToPersist);
                return;
            }

            if (!session && !inAuthRoute && !isLandingPage && !isPublicMarketingRoute && !isEphemeralFormRoute) {
                // User is not signed in and not in the auth group or landing page, redirect to landing page
                if (pathname !== '/') {
                    router.replace('/');
                }
            }
        };

        void handleRouting();
    }, [initialized, pathname, router, segments, session]);
};
