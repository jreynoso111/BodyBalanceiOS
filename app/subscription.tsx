import React from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View as RNView } from 'react-native';
import { Redirect } from 'expo-router';
import { Check, Shield, Smartphone } from 'lucide-react-native';

import { Card, Screen, Text } from '@/components/Themed';
import {
  getBillingEntitlementId,
  getBillingUnavailableReason,
  isBillingAvailable,
  purchasePremiumPackage,
} from '@/services/billing';
import { PLAN_LIMITS } from '@/services/subscriptionPlan';
import { formatReferralExpiry, getMyInviteSummary, InviteSummary } from '@/services/referrals';
import { useAuthStore } from '@/store/authStore';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';

export default function SubscriptionScreen() {
  const planTier = useAuthStore((state) => state.planTier);
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const planTitle = planTier === 'premium' ? 'Premium active' : 'Free plan';
  const unavailableReason = getBillingUnavailableReason();
  const [purchasePending, setPurchasePending] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [sendingInvite, setSendingInvite] = React.useState(false);
  const [referralSummary, setReferralSummary] = React.useState<InviteSummary | null>(null);

  React.useEffect(() => {
    let active = true;

    const loadReferralSummary = async () => {
      const { data } = await getMyInviteSummary();
      if (!active || !data) return;
      setReferralSummary(data);
    };

    void loadReferralSummary();

    return () => {
      active = false;
    };
  }, []);

  const handlePurchase = async () => {
    if (purchasePending) return;
    setPurchasePending(true);

    try {
      await purchasePremiumPackage();
      Alert.alert('Premium activated', 'Your membership is now active.');
    } catch (error: any) {
      Alert.alert('Purchase unavailable', error?.message || 'Premium checkout is not available right now.');
    } finally {
      setPurchasePending(false);
    }
  };

  const handleSendInviteEmail = async () => {
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      Alert.alert('Email required', 'Enter an email address to send the invite.');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(normalizedEmail)) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }

    if (!referralSummary?.inviteCode) {
      Alert.alert('Invite code unavailable', 'Your invite code is not ready yet. Try again in a moment.');
      return;
    }

    const inviterLabel =
      typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
        ? user.user_metadata.full_name.trim()
        : user?.email || 'me';
    const subject = 'Register on Buddy Balance with my friend code';
    const body =
      `Hi,\n\n` +
      `${inviterLabel} is inviting you to register on Buddy Balance.\n\n` +
      `When you create your account, use this friend code: ${referralSummary.inviteCode}\n\n` +
      `Buddy Balance helps friends and family keep track of money and shared records in one place.\n\n` +
      `See you in the app.`;
    const mailtoUrl =
      `mailto:${encodeURIComponent(normalizedEmail)}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    setSendingInvite(true);
    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (!supported) {
        Alert.alert('Email unavailable', 'This device cannot open the email composer right now.');
        return;
      }

      await Linking.openURL(mailtoUrl);
      Alert.alert('Invitation ready', 'Your email app opened with the invitation message prefilled.');
    } catch (error: any) {
      Alert.alert('Could not send invite', error?.message || 'The email composer could not be opened.');
    } finally {
      setSendingInvite(false);
    }
  };

  if (Platform.OS === 'web') {
    if (initialized && !user) {
      return <Redirect href="/(auth)/login" />;
    }

    return (
      <WebAccountLayout
        eyebrow="Membership"
        title={planTier === 'premium' ? 'Premium is active on this account.' : 'Free plan with a clear upgrade path.'}
        description="Membership on web reads the same plan state as the app. Premium, referrals, limits, and manual admin upgrades all show here."
      >
        <RNView style={styles.webGrid}>
          <Card style={styles.webPanel}>
            <Text style={styles.webPanelTitle}>Current plan</Text>
            <Text style={styles.webPlanValue}>{planTitle}</Text>
            <Text style={styles.webBody}>
              Buddy Balance Pro removes the friend and active record limits. Android checkout will be handled directly by Google Play when store billing is fully wired.
            </Text>
            {planTier !== 'premium' ? (
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.webPrimaryButton, purchasePending && styles.buttonDisabled]}
                onPress={() => void handlePurchase()}
                disabled={purchasePending}
              >
                {purchasePending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.webPrimaryButtonText}>Try Premium</Text>}
              </TouchableOpacity>
            ) : null}
          </Card>

          <Card style={styles.webPanel}>
            <Text style={styles.webPanelTitle}>What Premium unlocks</Text>
            {[
              `Unlimited linked friends instead of ${PLAN_LIMITS.free.linkedFriends}`,
              `Unlimited active records instead of ${PLAN_LIMITS.free.activeRecords}`,
              'Priority support for account issues',
              ...(planTier === 'premium' ? [] : ['1 free month of Premium every 3 successful invite code uses']),
            ].map((benefit) => (
              <RNView key={benefit} style={styles.webBenefitRow}>
                <Check size={15} color="#10B981" />
                <Text style={styles.webBenefitText}>{benefit}</Text>
              </RNView>
            ))}
          </Card>
        </RNView>

        {referralSummary ? (
          <RNView style={styles.webGrid}>
            <Card style={styles.webPanel}>
              <Text style={styles.webPanelTitle}>Referral status</Text>
              <Text style={styles.webBody}>
                {referralSummary.premiumReferralExpiresAt
                  ? `Referral Premium active until ${formatReferralExpiry(referralSummary.premiumReferralExpiresAt)}.`
                  : `${referralSummary.referralCount}/3 invite code uses earned toward your next free Premium month.`}
              </Text>
              <Text style={styles.webReferralCode}>Your code: {referralSummary.inviteCode || 'Loading...'}</Text>
            </Card>

            {planTier !== 'premium' ? (
              <Card style={styles.webPanel}>
                <Text style={styles.webPanelTitle}>Send an invite</Text>
                <TextInput
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="friend@example.com"
                  placeholderTextColor="#94A3B8"
                  style={styles.inviteInput}
                />
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={[styles.webPrimaryButton, sendingInvite && styles.buttonDisabled]}
                  onPress={() => void handleSendInviteEmail()}
                  disabled={sendingInvite}
                >
                  {sendingInvite ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.webPrimaryButtonText}>Send invite email</Text>}
                </TouchableOpacity>
              </Card>
            ) : null}
          </RNView>
        ) : null}
      </WebAccountLayout>
    );
  }

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.heroCard}>
          <RNView style={styles.heroIcon}>
            <Smartphone size={22} color="#6366F1" />
          </RNView>
          <Text style={styles.heroEyebrow}>Plan</Text>
          <Text style={styles.heroTitle}>{planTitle}</Text>
          <Text style={styles.heroText}>
            Buddy Balance Pro removes the friend and active record limits. Android checkout will be handled directly by Google
            Play.
          </Text>
          {planTier !== 'premium' ? (
            <RNView style={styles.ctaGroup}>
              <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.primaryButton, purchasePending && styles.buttonDisabled]}
                onPress={() => void handlePurchase()}
                disabled={purchasePending}
              >
                {purchasePending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Buy Premium</Text>}
              </TouchableOpacity>

              {isBillingAvailable() ? (
                <Text style={styles.ctaHint}>Use this screen to start Premium checkout directly from the app.</Text>
              ) : (
                <Text style={styles.ctaHint}>{unavailableReason}</Text>
              )}
            </RNView>
          ) : null}
        </Card>

        <Card style={styles.compareCard}>
          <Text style={styles.sectionTitle}>What Buddy Balance Pro unlocks</Text>
          {[
            `Unlimited linked friends instead of ${PLAN_LIMITS.free.linkedFriends}`,
            `Unlimited active records instead of ${PLAN_LIMITS.free.activeRecords}`,
            'Priority support for account issues',
            ...(planTier === 'premium' ? [] : ['1 free month of Premium every 3 successful invite code uses']),
            `Premium plan tier: "${getBillingEntitlementId()}"`,
          ].map((benefit) => (
            <RNView key={benefit} style={styles.benefitRow}>
              <RNView style={styles.benefitIcon}>
                <Check size={14} color="#10B981" />
              </RNView>
              <Text style={styles.benefitText}>{benefit}</Text>
            </RNView>
          ))}
        </Card>

        <Card style={styles.stateCard}>
          <RNView style={styles.statusIcon}>
            <Shield size={20} color="#1E293B" />
          </RNView>
          <Text style={styles.stateTitle}>Direct store billing is not live yet</Text>
          <Text style={styles.stateText}>
            {isBillingAvailable()
              ? 'Google Play will handle Premium purchases directly. Until that checkout is wired, admins can switch users between Free and Premium from the admin dashboard.'
              : unavailableReason}
          </Text>
          <Text style={styles.stateFootnote}>
            Current status: Premium access is controlled by `profiles.plan_tier` and can still be managed manually by an
            administrator.
          </Text>
          {referralSummary ? (
            <Text style={styles.androidHint}>
              {referralSummary.premiumReferralExpiresAt
                ? `Referral Premium active until ${formatReferralExpiry(referralSummary.premiumReferralExpiresAt)}.`
                : `${referralSummary.referralCount}/3 invite code uses earned toward your next free Premium month.`}
            </Text>
          ) : null}
          {Platform.OS === 'android' ? (
            <Text style={styles.androidHint}>
              Next step for Android: connect the Google Play in-app product and wire the purchase flow into this screen.
            </Text>
          ) : null}
        </Card>

        {planTier !== 'premium' && referralSummary ? (
          <Card style={styles.inviteCard}>
            <Text style={styles.sectionTitle}>Invite 3 people</Text>
            <Text style={styles.inviteText}>
              Send a prewritten email that invites someone to register and includes your friend code automatically.
            </Text>
            <Text style={styles.inviteCodeBadge}>Your friend code: {referralSummary.inviteCode || 'Loading...'}</Text>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="friend@example.com"
              placeholderTextColor="#94A3B8"
              style={styles.inviteInput}
            />
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.primaryButton, sendingInvite && styles.buttonDisabled]}
              onPress={() => void handleSendInviteEmail()}
              disabled={sendingInvite}
            >
              {sendingInvite ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Send invite</Text>}
            </TouchableOpacity>
            <Text style={styles.inviteHelper}>
              This opens the device email app with a ready-to-send invitation that already includes your friend code.
            </Text>
          </Card>
        ) : null}
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
    paddingTop: 32,
    paddingBottom: 48,
    gap: 16,
  },
  heroCard: {
    padding: 20,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#6366F1',
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  heroText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#64748B',
  },
  ctaGroup: {
    marginTop: 20,
    gap: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4F46E5',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  ctaHint: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  compareCard: {
    padding: 20,
  },
  inviteCard: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  benefitIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 23,
    color: '#334155',
  },
  stateCard: {
    padding: 20,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  stateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  stateText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475569',
  },
  stateFootnote: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
  },
  androidHint: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: '#6366F1',
    fontWeight: '700',
  },
  inviteText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
  },
  inviteCodeBadge: {
    marginTop: 14,
    marginBottom: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    color: '#4338CA',
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
  },
  inviteInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 12,
  },
  webGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  webPanel: {
    flex: 1,
    minWidth: 320,
    padding: 22,
  },
  webPanelTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  webPlanValue: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '900',
    color: '#4338CA',
    marginBottom: 12,
  },
  webBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#475569',
    marginBottom: 16,
  },
  webBenefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  webBenefitText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
  },
  webPrimaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  webPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  webReferralCode: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  inviteHelper: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },
});
