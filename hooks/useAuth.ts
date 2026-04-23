import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { clearPersistedAuthState, supabase } from '@/services/supabase';
import { configureBillingForUser } from '@/services/billing';
import { useAuthStore } from '@/store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDeviceLanguage, normalizeLanguage } from '@/constants/i18n';
import { normalizePlanTier } from '@/services/subscriptionPlan';
import { showSharedUpdateNotification } from '@/services/notificationService';
import { getMyInviteSummary, getMyPendingPremiumCelebration, recordSuccessfulLogin } from '@/services/referrals';
import { isTransientNetworkError, retryAsync } from '@/services/networkRetry';

const LAST_PROTECTED_PATH_KEY = 'last_protected_path';
const LAST_LOGIN_TRACKED_AT_PREFIX = 'last_login_tracked_at';
const NON_RECOVERABLE_PATH_PREFIXES = [
    '/admin',
    '/(admin)',
    '/new-contact',
    '/new-loan',
    '/payment',
    '/register-payment',
    '/profile',
    '/delete-account',
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
const isMissingTrialStartedAtColumn = (message?: string) =>
    String(message || '').toLowerCase().includes('trial_started_at');
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
    const { setSession, setUser, setRole, setPlanTier, setTrialStartedAt, setLanguage, setInitialized, session, initialized } = useAuthStore();
    const pathname = usePathname();
    const router = useRouter();
    const segments = useSegments();
    const profileSyncInFlightRef = useRef(false);
    const profileSyncQueuedRef = useRef(false);
    const loginTrackingInFlightRef = useRef<Promise<void> | null>(null);

    const navigateToLanding = () => {
        const resetNavigation = (router as any)?.dismissAll;
        if (typeof resetNavigation === 'function') {
            resetNavigation.call(router);
        }
        router.replace('/');
    };

    const trackLoginActivity = async (userId: string) => {
        const todayKey = `${LAST_LOGIN_TRACKED_AT_PREFIX}:${userId}`;
        const todayValue = new Date().toISOString().slice(0, 10);
        const lastTracked = await AsyncStorage.getItem(todayKey);
        if (lastTracked === todayValue) return;

        const loginResult = await recordSuccessfulLogin();
        if (loginResult.error) {
            throw loginResult.error;
        }

        await AsyncStorage.setItem(todayKey, todayValue);
    };

    const ensureLoginTracked = async (userId: string) => {
        if (!loginTrackingInFlightRef.current) {
            loginTrackingInFlightRef.current = trackLoginActivity(userId)
                .catch((error: any) => {
                    console.error('login tracking failed:', error?.message || error);
                })
                .finally(() => {
                    loginTrackingInFlightRef.current = null;
                });
        }

        await loginTrackingInFlightRef.current;
    };

    const resetLocalAuthState = async () => {
        await AsyncStorage.removeItem(LAST_PROTECTED_PATH_KEY);
        await clearPersistedAuthState();
        setSession(null);
        setUser(null);
        setRole(null);
        setPlanTier('free');
        setTrialStartedAt(null);
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
        return retryAsync(async () => {
            let { data, error } = await supabase
                .from('profiles')
                .select('role, default_language, plan_tier, premium_referral_expires_at, trial_started_at')
                .eq('id', userId)
                .maybeSingle();

            if (error && (isMissingDefaultLanguageColumn(error.message) || isMissingTrialStartedAtColumn(error.message))) {
                const fallbackFields = [
                    'role',
                    'plan_tier',
                    'premium_referral_expires_at',
                    ...(isMissingDefaultLanguageColumn(error.message) ? [] : ['default_language']),
                    ...(isMissingTrialStartedAtColumn(error.message) ? [] : ['trial_started_at']),
                ].join(', ');
                const fallback = await supabase
                    .from('profiles')
                    .select(fallbackFields)
                    .eq('id', userId)
                    .maybeSingle();
                data = fallback.data as any;
                error = fallback.error as any;
            }

            if (error) {
                throw new Error(error.message);
            }

            const normalizedRole = normalizeRole((data as any)?.role);
            const planTier = normalizePlanTier((data as any)?.plan_tier, (data as any)?.premium_referral_expires_at);
            const language = normalizeLanguage((data as any)?.default_language, getDeviceLanguage());
            const trialStartedAt = typeof (data as any)?.trial_started_at === 'string' ? (data as any)?.trial_started_at : null;

            return { normalizedRole, planTier, language, trialStartedAt };
        }, {
            retries: 2,
            delayMs: 900,
            shouldRetry: isTransientNetworkError,
        });
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

                const { normalizedRole, planTier, language, trialStartedAt } = await fetchProfileMeta(userId);
                setRole(normalizedRole);
                setPlanTier(planTier);
                setTrialStartedAt(trialStartedAt);
                setLanguage(language);
                await hydratePendingReferralReward();
            } while (profileSyncQueuedRef.current);
        } finally {
            profileSyncInFlightRef.current = false;
        }
    };

    const hydrateSignedInUser = async (sessionUser: NonNullable<typeof session>['user']) => {
        try {
            await configureBillingForUser({
                userId: sessionUser.id,
                email: sessionUser.email ?? null,
                phone: sessionUser.phone ?? null,
                displayName:
                    typeof sessionUser.user_metadata?.full_name === 'string'
                        ? sessionUser.user_metadata.full_name
                        : null,
            });
        } catch (error: any) {
            console.error('billing initialization failed:', error?.message || error);
        }

        try {
            await syncProfileState(sessionUser.id);
        } catch (error: any) {
            console.error('profile sync failed:', error?.message || error);
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
                    await ensureLoginTracked(session.user.id);
                    await hydrateSignedInUser(session.user);
                } else {
                    await configureBillingForUser({});
                    setRole(null);
                    setPlanTier('free');
                    setTrialStartedAt(null);
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
                setTrialStartedAt(null);
                setLanguage(getDeviceLanguage());
            } finally {
                setInitialized(true);
            }
        };

        checkSession();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                try {
                    setSession(session);
                    setUser(session?.user ?? null);

                    if (session?.user?.id) {
                        await ensureLoginTracked(session.user.id);
                        await hydrateSignedInUser(session.user);
                    } else {
                        try {
                            await configureBillingForUser({});
                        } catch (error: any) {
                            console.error('billing teardown failed:', error?.message || error);
                        }
                        setRole(null);
                        setPlanTier('free');
                        setTrialStartedAt(null);
                        setLanguage(getDeviceLanguage());
                        // Prevent stale protected-route recovery after a sign-out.
                        await AsyncStorage.removeItem(LAST_PROTECTED_PATH_KEY);
                    }

                    if (event === 'SIGNED_OUT') {
                        navigateToLanding();
                    }
                } catch (error: any) {
                    console.error('auth state change handling failed:', error?.message || error);
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
                    navigateToLanding();
                }
            }
        };

        void handleRouting();
    }, [initialized, pathname, router, segments, session]);
};
