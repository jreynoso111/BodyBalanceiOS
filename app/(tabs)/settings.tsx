import React from 'react';
import { StyleSheet, TouchableOpacity, Alert, View as RNView, ScrollView, Image, RefreshControl, Platform, Pressable } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { Text, View, Screen, Card } from '@/components/Themed';
import { signOutLocalSession, supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/authStore';
import { LogOut, User, Bell, Shield, CircleHelp, FileOutput, ChevronRight, Sparkles, SlidersHorizontal } from 'lucide-react-native';
import { exportLoansToCSV } from '@/services/exportService';
import { useFocusEffect, useRouter } from 'expo-router';
import { DEFAULT_USER_PREFERENCES, getOrCreateUserPreferences } from '@/services/userPreferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfileAvatarPublicUrl, isMissingAvatarUrlColumn } from '@/services/profileAvatar';
import { getMembershipStatus, getPlanLabel, hasPremiumAccess, normalizePlanTier } from '@/services/subscriptionPlan';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';
import { useI18n } from '@/hooks/useI18n';
import { useAppTheme } from '@/hooks/useAppTheme';

const LAST_PROTECTED_PATH_KEY = 'last_protected_path';

export default function SettingsScreen() {
    const { user, role, planTier, trialStartedAt, initialized, setSession, setUser, setRole, setPlanTier, setTrialStartedAt } = useAuthStore();
    const { t } = useI18n();
    const { theme, colorScheme } = useAppTheme();
    const router = useRouter();
    const [prefs, setPrefs] = React.useState(DEFAULT_USER_PREFERENCES);
    const [profileName, setProfileName] = React.useState('');
    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
    const [refreshing, setRefreshing] = React.useState(false);
    const [signingOut, setSigningOut] = React.useState(false);
    const normalizedRole = (role || '').toLowerCase().trim();
    const hasAdminAccess = normalizedRole === 'admin' || normalizedRole === 'administrator';
    const isDark = colorScheme === 'dark';

    if (initialized && !user) {
        return <Redirect href="/" />;
    }

    const navigateToLanding = () => {
        const resetNavigation = (router as any)?.dismissAll;
        if (typeof resetNavigation === 'function') {
            resetNavigation.call(router);
        }
        router.replace('/');
    };

    useFocusEffect(
        React.useCallback(() => {
            if (!user?.id) return;
            void loadPreferences();
            void loadProfileSummary();
        }, [user?.id])
    );

    const loadPreferences = async () => {
        if (!user?.id) return;
        const { data } = await getOrCreateUserPreferences(user.id);
        if (data) {
            setPrefs({
                push_enabled: data.push_enabled,
                email_enabled: data.email_enabled,
                reminder_enabled: data.reminder_enabled,
                biometric_enabled: data.biometric_enabled,
                marketing_enabled: data.marketing_enabled,
                preferred_currencies: data.preferred_currencies,
            });
        }
    };

    const loadProfileSummary = async () => {
        if (!user?.id) return;

        let { data, error } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, plan_tier, premium_referral_expires_at')
            .eq('id', user.id)
            .maybeSingle();

        if (error && isMissingAvatarUrlColumn(error.message)) {
            const fallback = await supabase
                .from('profiles')
                .select('full_name, plan_tier, premium_referral_expires_at')
                .eq('id', user.id)
                .maybeSingle();
            data = fallback.data as any;
            error = fallback.error as any;
        }

        if (error) {
            console.error('profile summary load failed:', error.message);
            return;
        }

        setProfileName(data?.full_name || '');
        setAvatarUrl(getProfileAvatarPublicUrl((data as any)?.avatar_url || null));
        setPlanTier(normalizePlanTier((data as any)?.plan_tier, (data as any)?.premium_referral_expires_at));
    };

    const handleSignOut = async () => {
        if (signingOut) return;
        setSigningOut(true);

        try {
            await AsyncStorage.removeItem(LAST_PROTECTED_PATH_KEY);
            await signOutLocalSession();

            setSession(null);
            setUser(null);
            setRole(null);
            setPlanTier('free');
            setTrialStartedAt(null);
            navigateToLanding();
        } catch (error: any) {
            try {
                await signOutLocalSession();
                setSession(null);
                setUser(null);
                setRole(null);
                setPlanTier('free');
                setTrialStartedAt(null);
                navigateToLanding();
            } catch {
                Alert.alert(t('Error'), error?.message || t('Could not sign out right now.'));
            }
        } finally {
            setSigningOut(false);
        }
    };

    const handleExport = async () => {
        if (!hasPremiumAccess(planTier, { trialStartedAt })) {
            Alert.alert(t('Membership required'), t('CSV export is available during the 21-day free trial or with Premium.'));
            return;
        }

        if (user) {
            await exportLoansToCSV(user.id);
        }
    };

    const handleRefresh = async () => {
        if (!user?.id) return;
        setRefreshing(true);
        try {
            await Promise.all([loadPreferences(), loadProfileSummary()]);
        } finally {
            setRefreshing(false);
        }
    };

    const membershipStatus = getMembershipStatus(planTier, { trialStartedAt });
    const hasPaidOrTrialAccess = membershipStatus !== 'free';
    const localizedPlanLabel = t(getPlanLabel(planTier, { trialStartedAt }));

    const menuItems = [
        {
            icon: Sparkles,
            label: t(membershipStatus === 'premium' ? 'Manage Premium' : membershipStatus === 'trial' ? 'Manage Trial' : 'Start Premium'),
            sub: t(membershipStatus === 'premium' ? 'Annual membership active' : membershipStatus === 'trial' ? '21-day free trial active' : 'Your 21-day free trial has ended'),
            onPress: () => router.push('/subscription' as any),
        },
        { icon: User, label: t('Profile'), sub: t('Photo, name, phone, referral status'), onPress: () => router.push('/profile') },
        { icon: SlidersHorizontal, label: t('Preferences'), sub: t('Appearance, language, currency'), onPress: () => router.push('/preferences') },
        { icon: Bell, label: t('Notifications'), sub: t(prefs.push_enabled ? 'Enabled' : 'Disabled'), onPress: () => router.push('/notifications') },
        { icon: Shield, label: t('Security'), sub: t(prefs.biometric_enabled ? 'Biometric On' : 'Biometric Off'), onPress: () => router.push('/security') },
        { icon: CircleHelp, label: t('Help & Support'), sub: t('FAQ & guidance'), onPress: () => router.push('/help-support') },
    ];

    if (hasPaidOrTrialAccess) {
        menuItems.splice(4, 0, {
            icon: FileOutput,
            label: t('Export Data (CSV)'),
            sub: t(membershipStatus === 'trial' ? 'Included during trial' : 'Share report'),
            onPress: handleExport,
        });
    }

    if (hasAdminAccess) {
        menuItems.unshift({
            icon: Shield,
            label: t('Admin Dashboard'),
            sub: t('Manage users and platform data'),
            onPress: () => router.push('/admin' as any),
        });
    }

    const avatarInitial = (profileName || user?.email || '?').trim().charAt(0).toUpperCase();

    if (Platform.OS === 'web') {
        return (
            <WebAccountLayout
                eyebrow={t('Account Center')}
                title={t('Manage the same Buddy Balance account you use in the app.')}
                description={t('This web area gives you a cleaner desktop surface for profile management, membership status, security controls, notifications, exports, and support.')}
            >
                <View style={styles.webGrid}>
                    <Card style={styles.webSummaryCard}>
                        <RNView style={styles.webSummaryTop}>
                            <RNView style={styles.avatarLarge}>
                                {avatarUrl ? (
                                    <Image source={{ uri: avatarUrl }} style={styles.avatarLargeImage} />
                                ) : (
                                    <Text style={styles.avatarLargeText}>{avatarInitial}</Text>
                                )}
                            </RNView>
                            <RNView style={styles.webSummaryCopy}>
                                <Text style={styles.webSummaryName}>{profileName || t('Buddy Balance account')}</Text>
                                <Text style={styles.webSummaryEmail}>{user?.email}</Text>
                                <Text style={styles.webSummaryMeta}>{localizedPlanLabel} {t('plan')}{hasAdminAccess ? ` • ${t('Admin access')}` : ''}</Text>
                            </RNView>
                        </RNView>
                        <Text style={styles.webSummaryText}>
                            {t('Use Profile for personal identity details, Preferences for appearance and app defaults, Membership to review Premium access, Notifications to tune alerts, and Security to control biometrics and password changes.')}
                        </Text>
                    </Card>

                    <Card style={styles.webActionCard}>
                        <Text style={styles.webCardTitle}>{t('Account management')}</Text>
                        <RNView style={styles.webLinkStack}>
                            <Link href="/dashboard" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('Dashboard overview')}</Text></Pressable></Link>
                            <Link href="/profile" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('Edit profile')}</Text></Pressable></Link>
                            <Link href="/preferences" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('Preferences')}</Text></Pressable></Link>
                            <Link href="/subscription" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('View membership')}</Text></Pressable></Link>
                            <Link href="/notifications" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('Notification settings')}</Text></Pressable></Link>
                            <Link href="/security" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('Security settings')}</Text></Pressable></Link>
                            <Link href="/help-support" asChild><Pressable style={styles.webLinkButton}><Text style={styles.webLinkText}>{t('Support and policies')}</Text></Pressable></Link>
                        </RNView>
                    </Card>
                </View>

                <View style={styles.webGrid}>
                    <Card style={styles.webStatusCard}>
                        <Text style={styles.webCardTitle}>{t('Current status')}</Text>
                        <Text style={styles.webStatusLine}>{t('Plan')}: {localizedPlanLabel}</Text>
                        <Text style={styles.webStatusLine}>{t('Push alerts')}: {t(prefs.push_enabled ? 'Enabled' : 'Disabled')}</Text>
                        <Text style={styles.webStatusLine}>{t('Biometric lock')}: {t(prefs.biometric_enabled ? 'Enabled' : 'Disabled')}</Text>
                        <Text style={styles.webStatusLine}>{t('Marketing updates')}: {t(prefs.marketing_enabled ? 'Enabled' : 'Disabled')}</Text>
                    </Card>

                    <Card style={styles.webStatusCard}>
                        <Text style={styles.webCardTitle}>{t('Quick actions')}</Text>
                        {hasPaidOrTrialAccess ? (
                            <TouchableOpacity style={styles.webPrimaryButton} onPress={handleExport}>
                                <Text style={styles.webPrimaryButtonText}>{t(membershipStatus === 'trial' ? 'Export CSV (trial)' : 'Export CSV')}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Link href="/subscription" asChild>
                                <Pressable style={styles.webPrimaryButton}>
                                    <Text style={styles.webPrimaryButtonText}>{t('See Premium options')}</Text>
                                </Pressable>
                            </Link>
                        )}
                        <TouchableOpacity style={styles.webSecondaryButton} onPress={handleSignOut} disabled={signingOut}>
                            <Text style={styles.webSecondaryButtonText}>{signingOut ? t('Signing out...') : t('Sign out')}</Text>
                        </TouchableOpacity>
                    </Card>
                </View>
            </WebAccountLayout>
        );
    }

    return (
        <Screen style={styles.container} safeAreaEdges={['left', 'right', 'bottom']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
            >
                <View style={styles.profileSection}>
                    <RNView style={styles.avatarLarge}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatarLargeImage} />
                        ) : (
                            <Text style={styles.avatarLargeText}>{avatarInitial}</Text>
                        )}
                    </RNView>
                    {profileName ? <Text style={styles.profileName}>{profileName}</Text> : null}
                    <Text style={styles.profileEmail}>{user?.email}</Text>
                    <Text style={styles.profileSub}>{localizedPlanLabel} {t('Plan')} • {t(hasAdminAccess ? 'Admin' : 'User')}</Text>
                </View>

                <Card style={styles.menuCard}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[
                                styles.item,
                                index === menuItems.length - 1 && { borderBottomWidth: 0 },
                            ]}
                            onPress={item.onPress}
                        >
                            <RNView style={styles.itemLeft}>
                                <RNView style={[styles.iconCircle, { backgroundColor: theme.tintSoft, borderColor: theme.navigation.border }]}>
                                    <item.icon size={20} color={theme.tint} />
                                </RNView>
                                <RNView style={styles.textContainer}>
                                    <Text style={[styles.label, { color: theme.title }]}>{item.label}</Text>
                                    {item.sub ? <Text style={[styles.subLabel, { color: theme.secondaryText }]}>{item.sub}</Text> : null}
                                </RNView>
                            </RNView>
                            <ChevronRight size={18} color={theme.tertiaryText} />
                        </TouchableOpacity>
                    ))}
                </Card>

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut}>
                    <LogOut size={20} color="#EF4444" />
                    <Text style={styles.signOutText}>{signingOut ? t('Signing out...') : t('Sign out')}</Text>
                </TouchableOpacity>

                <Text style={[styles.version, { color: theme.tertiaryText }]}>Buddy Balance v1.0.0</Text>
            </ScrollView>
        </Screen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingTop: 16,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 32,
        backgroundColor: 'transparent',
    },
    avatarLarge: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    avatarLargeImage: {
        width: '100%',
        height: '100%',
    },
    avatarLargeText: {
        fontSize: 32,
        fontWeight: '800',
        color: '#6366F1',
    },
    profileName: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 2,
    },
    profileEmail: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    profileSub: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    menuCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 24,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    textContainer: {
        marginLeft: 16,
        backgroundColor: 'transparent',
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B',
    },
    subLabel: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        backgroundColor: 'rgba(239, 68, 68, 0.05)',
        borderRadius: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.1)',
    },
    signOutText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '700',
    },
    deleteAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        marginTop: 12,
        backgroundColor: '#FEF2F2',
        borderRadius: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    deleteAccountText: {
        color: '#B91C1C',
        fontSize: 16,
        fontWeight: '700',
    },
    version: {
        textAlign: 'center',
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 40,
        marginBottom: 20,
    },
    webGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
    },
    webSummaryCard: {
        flex: 1,
        minWidth: 320,
        padding: 22,
    },
    webActionCard: {
        width: 320,
        padding: 22,
    },
    webSummaryTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
    },
    webSummaryCopy: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    webSummaryName: {
        fontSize: 24,
        lineHeight: 30,
        fontWeight: '900',
        color: '#0F172A',
    },
    webSummaryEmail: {
        marginTop: 4,
        fontSize: 14,
        lineHeight: 22,
        color: '#475569',
    },
    webSummaryMeta: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '800',
        color: '#6366F1',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    webSummaryText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#475569',
    },
    webCardTitle: {
        fontSize: 18,
        lineHeight: 24,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 14,
    },
    webLinkStack: {
        gap: 10,
        backgroundColor: 'transparent',
    },
    webLinkButton: {
        minHeight: 46,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#D6DAFF',
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 14,
        paddingVertical: 12,
        justifyContent: 'center',
    },
    webLinkText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1E293B',
    },
    webStatusCard: {
        flex: 1,
        minWidth: 280,
        padding: 22,
    },
    webStatusLine: {
        fontSize: 14,
        lineHeight: 22,
        color: '#475569',
        marginBottom: 8,
    },
    webPrimaryButton: {
        minHeight: 48,
        borderRadius: 16,
        backgroundColor: '#4F46E5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        paddingHorizontal: 16,
    },
    webPrimaryButtonText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    webSecondaryButton: {
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    webSecondaryButtonText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#1E293B',
    },
    webDangerButton: {
        minHeight: 48,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FCA5A5',
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        marginTop: 10,
    },
    webDangerButtonText: {
        fontSize: 14,
        fontWeight: '800',
        color: '#B91C1C',
    },
});
