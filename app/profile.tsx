import React, { useCallback, useRef, useState } from 'react';
import { Alert, Image, ScrollView, Share, StyleSheet, TextInput, TouchableOpacity, View as RNView, RefreshControl, Platform } from 'react-native';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Card, Text, View } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/services/supabase';
import { CURRENCIES } from '@/constants/Currencies';
import { AppLanguage, getDeviceLanguage, normalizeLanguage, SUPPORTED_LANGUAGES } from '@/constants/i18n';
import { useI18n } from '@/hooks/useI18n';
import { ArrowLeft, Camera, House, Trash2 } from 'lucide-react-native';
import {
  getProfileAvatarPublicUrl,
  isMissingAvatarUrlColumn,
  removeProfileAvatar,
  uploadProfileAvatar,
} from '@/services/profileAvatar';
import { applyInvitationCode, formatReferralExpiry, getMyInviteSummary, InviteSummary } from '@/services/referrals';
import { normalizePlanTier } from '@/services/subscriptionPlan';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';

const isMissingDefaultLanguageColumn = (message?: string) =>
  String(message || '').toLowerCase().includes('default_language');
const isMissingFriendCodeColumn = (message?: string) =>
  String(message || '').toLowerCase().includes('friend_code');

export default function ProfileScreen() {
  const { user, planTier, initialized, setLanguage, setPlanTier } = useAuthStore();
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendCodeStatus, setFriendCodeStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currencyDefault, setCurrencyDefault] = useState('USD');
  const [defaultLanguage, setDefaultLanguage] = useState<AppLanguage>(getDeviceLanguage());
  const [friendCode, setFriendCode] = useState('');
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [inviteSummary, setInviteSummary] = useState<InviteSummary | null>(null);
  const [applyingInviteCode, setApplyingInviteCode] = useState(false);
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarMarkedForRemoval, setAvatarMarkedForRemoval] = useState(false);
  const [avatarDirty, setAvatarDirty] = useState(false);
  const avatarBase64Ref = useRef<string | null>(null);
  const avatarMimeTypeRef = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    setInitializing(true);
    setFriendCodeStatus('loading');
    setFullName((current) => current || String(user.user_metadata?.full_name || '').trim());
    setEmail((current) => current || user.email || '');

    const fullFields = 'full_name, email, phone, currency_default, default_language, avatar_url, friend_code, plan_tier, premium_referral_expires_at';
    let { data, error } = await supabase
      .from('profiles')
      .select(fullFields)
      .eq('id', user.id)
      .maybeSingle();

    if (error && (isMissingDefaultLanguageColumn(error.message) || isMissingAvatarUrlColumn(error.message) || isMissingFriendCodeColumn(error.message))) {
      const fallbackFields = [
        'full_name',
        'email',
        'phone',
        'currency_default',
        'plan_tier',
        'premium_referral_expires_at',
        ...(isMissingDefaultLanguageColumn(error.message) ? [] : ['default_language']),
        ...(isMissingAvatarUrlColumn(error.message) ? [] : ['avatar_url']),
        ...(isMissingFriendCodeColumn(error.message) ? [] : ['friend_code']),
      ].join(', ');

      const fallback = await supabase
        .from('profiles')
        .select(fallbackFields)
        .eq('id', user.id)
        .maybeSingle();

      data = fallback.data as any;
      error = fallback.error as any;
    }

    if (error) {
      console.error('profile load failed:', error.message);
      Alert.alert('Error', error.message);
      setInitializing(false);
      return;
    }

    if (!data) {
      const { data: upserted, error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            full_name: String(user.user_metadata?.full_name || '').trim() || null,
            email: user.email || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select(fullFields)
        .maybeSingle();

      if (upsertError) {
        console.error('profile bootstrap failed:', upsertError.message);
      } else {
        data = upserted as any;
      }
    }

    let resolvedFriendCode = String((data as any)?.friend_code || '').trim();
    if (!resolvedFriendCode) {
      const { data: ensuredCode, error: ensureError } = await supabase.rpc('ensure_my_friend_code');
      if (ensureError) {
        console.error('friend code ensure failed:', ensureError.message);
      } else {
        resolvedFriendCode = String(ensuredCode || '').trim();
      }
    }

    if (data) {
      const nextAvatarPath = (data as any).avatar_url || null;
      setFullName(data.full_name || String(user.user_metadata?.full_name || '').trim() || '');
      setEmail(data.email || user.email || '');
      setPhone(data.phone || '');
      setCurrencyDefault(data.currency_default || 'USD');
      setDefaultLanguage(normalizeLanguage((data as any).default_language, getDeviceLanguage()));
      setFriendCode(resolvedFriendCode);
      setFriendCodeStatus(resolvedFriendCode ? 'ready' : 'missing');
      setPlanTier(normalizePlanTier((data as any)?.plan_tier, (data as any)?.premium_referral_expires_at));
      setAvatarPath(nextAvatarPath);
      setAvatarPreviewUrl(getProfileAvatarPublicUrl(nextAvatarPath));
    } else {
      setFullName(String(user.user_metadata?.full_name || '').trim());
      setEmail(user.email || '');
      setFriendCode(resolvedFriendCode);
      setFriendCodeStatus(resolvedFriendCode ? 'ready' : 'missing');
      setAvatarPath(null);
      setAvatarPreviewUrl(null);
    }

    const inviteSummaryResult = await getMyInviteSummary();
    if (inviteSummaryResult.data) {
      setInviteSummary(inviteSummaryResult.data);
      setInviteCodeInput((current) => current || inviteSummaryResult.data?.referredByCode || '');
    }

    avatarBase64Ref.current = null;
    avatarMimeTypeRef.current = null;
    setAvatarMarkedForRemoval(false);
    setAvatarDirty(false);
    setInitializing(false);
  }, [setPlanTier, user?.email, user?.id, user?.user_metadata?.full_name]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void loadProfile();
    }, [loadProfile, user?.id])
  );

  const pickAvatar = async () => {
    if (loading || initializing) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Error', 'Could not read the selected image.');
      return;
    }

    avatarBase64Ref.current = asset.base64;
    avatarMimeTypeRef.current = asset.mimeType || 'image/jpeg';
    setAvatarPreviewUrl(asset.uri);
    setAvatarMarkedForRemoval(false);
    setAvatarDirty(true);
  };

  const removeAvatarSelection = () => {
    if (!avatarPreviewUrl && !avatarPath) return;

    avatarBase64Ref.current = null;
    avatarMimeTypeRef.current = null;
    setAvatarPreviewUrl(null);
    setAvatarMarkedForRemoval(true);
    setAvatarDirty(true);
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setLoading(true);

    const previousAvatarPath = avatarPath;
    let uploadedAvatarPath: string | null = null;
    let nextAvatarPath = avatarMarkedForRemoval ? null : avatarPath;
    let languageSavedWithFallback = false;
    let avatarSavedWithFallback = false;

    try {
      if (avatarBase64Ref.current && !avatarMarkedForRemoval) {
        uploadedAvatarPath = await uploadProfileAvatar({
          userId: user.id,
          base64: avatarBase64Ref.current,
          mimeType: avatarMimeTypeRef.current,
        });
        nextAvatarPath = uploadedAvatarPath;
      }

      const patch: Record<string, any> = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || user.email || null,
        currency_default: currencyDefault,
        default_language: defaultLanguage,
        avatar_url: nextAvatarPath,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('profiles').update(patch).eq('id', user.id);

      if (error && (isMissingDefaultLanguageColumn(error.message) || isMissingAvatarUrlColumn(error.message))) {
        languageSavedWithFallback = isMissingDefaultLanguageColumn(error.message);
        avatarSavedWithFallback = isMissingAvatarUrlColumn(error.message);

        const fallbackPatch = { ...patch };
        if (languageSavedWithFallback) {
          delete fallbackPatch.default_language;
        }
        if (avatarSavedWithFallback) {
          delete fallbackPatch.avatar_url;
        }

        const fallback = await supabase.from('profiles').update(fallbackPatch).eq('id', user.id);
        error = fallback.error as any;
      }

      if (error) {
        throw error;
      }

      if (uploadedAvatarPath && avatarSavedWithFallback) {
        await removeProfileAvatar(uploadedAvatarPath);
        nextAvatarPath = previousAvatarPath;
      }

      if (!avatarSavedWithFallback) {
        if (avatarMarkedForRemoval && previousAvatarPath) {
          await removeProfileAvatar(previousAvatarPath);
        }
        if (uploadedAvatarPath && previousAvatarPath && previousAvatarPath !== uploadedAvatarPath) {
          await removeProfileAvatar(previousAvatarPath);
        }
      }

      setLanguage(defaultLanguage);
      setAvatarPath(nextAvatarPath);
      setAvatarPreviewUrl(getProfileAvatarPublicUrl(nextAvatarPath));
      avatarBase64Ref.current = null;
      avatarMimeTypeRef.current = null;
      setAvatarMarkedForRemoval(false);
      setAvatarDirty(false);

      const fallbackNotes = [];
      if (languageSavedWithFallback) {
        fallbackNotes.push('Default Language');
      }
      if (avatarSavedWithFallback) {
        fallbackNotes.push('Profile Photo');
      }

      Alert.alert(
        'Success',
        fallbackNotes.length > 0
          ? `Profile updated. Run the latest Supabase migration to persist: ${fallbackNotes.join(', ')}.`
          : 'Profile updated'
      );
    } catch (error: any) {
      if (uploadedAvatarPath) {
        await removeProfileAvatar(uploadedAvatarPath);
      }
      Alert.alert('Error', error?.message || 'Could not update your profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleShareFriendCode = async () => {
    if (!friendCode) {
      Alert.alert('Error', 'Friend code is not ready yet.');
      return;
    }

    try {
      await Share.share({
        message: `Join me on Buddy Balance and use my invite code ${friendCode}. Every 3 successful uses unlocks 1 month of Premium for me.`,
      });
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not open the share sheet.');
    }
  };

  const handleApplyInviteCode = async () => {
    const normalizedCode = inviteCodeInput.trim().toUpperCase();
    if (!normalizedCode) {
      Alert.alert('Invite code needed', 'Enter an invite code to redeem it.');
      return;
    }

    if (normalizedCode === friendCode.trim().toUpperCase()) {
      Alert.alert('Invalid invite code', 'You cannot use your own invite code.');
      return;
    }

    setApplyingInviteCode(true);
    try {
      const { data, error } = await applyInvitationCode(normalizedCode);
      if (error) {
        throw error;
      }

      await loadProfile();
      Alert.alert(
        'Invite code applied',
        data?.rewardMonths
          ? 'This redemption completed a reward cycle for your friend. Your account is now linked to their invite.'
          : 'The invite code was saved successfully.'
      );
    } catch (error: any) {
      Alert.alert('Could not apply invite code', error?.message || 'Try again in a moment.');
    } finally {
      setApplyingInviteCode(false);
    }
  };

  const profileInitial = (fullName || email || user?.email || '?').trim().charAt(0).toUpperCase();
  const rewardExpiryLabel = formatReferralExpiry(inviteSummary?.premiumReferralExpiresAt);

  const handleRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await loadProfile();
    } finally {
      setRefreshing(false);
    }
  };

  if (Platform.OS === 'web') {
    if (initialized && !user) {
      return <Redirect href="/(auth)/login" />;
    }

    return (
      <WebAccountLayout
        eyebrow="Profile"
        title="Edit identity, defaults, and invite settings."
        description="These changes update the same Buddy Balance profile record used by the mobile app."
      >
        <Card style={styles.webProfileCard}>
          <RNView style={styles.webAvatarRow}>
            <RNView style={styles.avatarButton}>
              {avatarPreviewUrl ? (
                <Image source={{ uri: avatarPreviewUrl }} style={styles.avatarImage} />
              ) : (
                <RNView style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{profileInitial}</Text>
                </RNView>
              )}
            </RNView>
            <RNView style={styles.webAvatarCopy}>
              <Text style={styles.webCardTitle}>Profile photo</Text>
              <Text style={styles.webCardBody}>Use the mobile app if you want to upload or crop a new avatar. Web focuses on account management and profile data.</Text>
            </RNView>
          </RNView>
        </Card>

        <View style={styles.webGrid}>
          <Card style={styles.webFormCard}>
            <Text style={styles.webCardTitle}>Identity</Text>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder={t('Your full name')}
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555 555 5555"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.label}>Default Currency</Text>
            <TextInput
              style={styles.input}
              placeholder="USD"
              placeholderTextColor="#94A3B8"
              value={currencyDefault}
              onChangeText={setCurrencyDefault}
            />

            <Text style={styles.label}>Default Language</Text>
            <TextInput
              style={styles.input}
              placeholder="en"
              placeholderTextColor="#94A3B8"
              value={defaultLanguage}
              onChangeText={(value) => setDefaultLanguage(normalizeLanguage(value, getDeviceLanguage()))}
            />

            <TouchableOpacity style={styles.webPrimaryButton} onPress={() => void handleSave()} disabled={loading || initializing}>
              <Text style={styles.webPrimaryButtonText}>{loading ? 'Saving...' : 'Save profile'}</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.webInviteCard}>
            <Text style={styles.webCardTitle}>Invite and referral</Text>
            <Text style={styles.webCardBody}>Your invite code links new people to your Buddy Balance network and can unlock referral Premium time.</Text>
            <Text selectable style={styles.webInviteCode}>{friendCode || 'Setting up...'}</Text>
            <TouchableOpacity
              style={[styles.webSecondaryButton, !friendCode && styles.webSecondaryButtonDisabled]}
              onPress={() => { void handleShareFriendCode(); }}
              disabled={!friendCode}
            >
              <Text style={styles.webSecondaryButtonText}>Share code</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Enter an invite code"
              placeholderTextColor="#94A3B8"
              value={inviteCodeInput}
              onChangeText={setInviteCodeInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.webPrimaryButton}
              onPress={() => void handleApplyInviteCode()}
              disabled={applyingInviteCode}
            >
              <Text style={styles.webPrimaryButtonText}>{applyingInviteCode ? 'Applying...' : 'Apply invite code'}</Text>
            </TouchableOpacity>

            {inviteSummary ? (
              <Text style={styles.webHintText}>
                {rewardExpiryLabel
                  ? `Referral Premium active until ${rewardExpiryLabel}.`
                  : `${inviteSummary.referralCount}/3 successful invite uses earned toward the next free Premium month.`}
              </Text>
            ) : null}
          </Card>
        </View>
      </WebAccountLayout>
    );
  }

  return (
    <Screen style={styles.container} safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: t('Profile'),
          headerTransparent: false,
          headerStyle: {
            backgroundColor: '#FFFFFF',
          },
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.replace('/(tabs)/settings')}
            >
              <ArrowLeft size={20} color="#0F172A" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <House size={19} color="#0F172A" />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />}
      >
        <RNView style={styles.inlineNavRow}>
          <TouchableOpacity style={styles.inlineNavButton} onPress={() => router.replace('/(tabs)/settings')}>
            <ArrowLeft size={16} color="#0F172A" />
            <Text style={styles.inlineNavButtonText}>Back to settings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inlineNavButton} onPress={() => router.replace('/(tabs)')}>
            <House size={16} color="#0F172A" />
            <Text style={styles.inlineNavButtonText}>Home</Text>
          </TouchableOpacity>
        </RNView>

        <Card style={styles.card}>
          <RNView style={styles.avatarSection}>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => {
                void pickAvatar();
              }}
              disabled={loading || initializing}
            >
              {avatarPreviewUrl ? (
                <Image source={{ uri: avatarPreviewUrl }} style={styles.avatarImage} />
              ) : (
                <RNView style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>{profileInitial}</Text>
                </RNView>
              )}
              <RNView style={styles.avatarBadge}>
                <Camera size={16} color="#FFFFFF" />
              </RNView>
            </TouchableOpacity>

            <RNView style={styles.avatarActions}>
              <TouchableOpacity
                style={styles.avatarActionButton}
                onPress={() => {
                  void pickAvatar();
                }}
                disabled={loading || initializing}
              >
                <Text style={styles.avatarActionButtonText}>{avatarPreviewUrl ? 'Change photo' : 'Add photo'}</Text>
              </TouchableOpacity>

              {(avatarPreviewUrl || avatarPath) ? (
                <TouchableOpacity
                  style={styles.avatarRemoveButton}
                  onPress={removeAvatarSelection}
                  disabled={loading || initializing}
                >
                  <Trash2 size={16} color="#EF4444" />
                  <Text style={styles.avatarRemoveButtonText}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </RNView>

            <Text style={styles.avatarHint}>
              {avatarDirty ? 'Save Profile to keep photo changes.' : 'Your profile photo appears in your account screens.'}
            </Text>
          </RNView>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder={t('Your full name')}
            placeholderTextColor="#94A3B8"
            value={fullName}
            onChangeText={setFullName}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@example.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 555 555 5555"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <RNView style={styles.friendCodeCard}>
            <Text style={styles.friendCodeLabel}>Invite Code</Text>
            <Text selectable style={styles.friendCodeValue}>
              {friendCode || (friendCodeStatus === 'loading' ? 'Setting up...' : 'Unavailable')}
            </Text>
            <Text style={styles.friendCodeHint}>
              Share this code with friends who are not in the app yet. Every 3 successful uses unlocks 1 month of Premium.
            </Text>
            <RNView style={styles.friendCodeActions}>
              <TouchableOpacity
                style={[styles.friendCodeButton, !friendCode && styles.friendCodeButtonDisabled]}
                onPress={() => {
                  void handleShareFriendCode();
                }}
                disabled={!friendCode}
              >
                <Text style={styles.friendCodeButtonText}>Share Code</Text>
              </TouchableOpacity>
              {!friendCode ? (
                <TouchableOpacity
                  style={styles.friendCodeRetryButton}
                  onPress={() => {
                    void loadProfile();
                  }}
                  disabled={initializing}
                >
                  <Text style={styles.friendCodeRetryButtonText}>Refresh Code</Text>
                </TouchableOpacity>
              ) : null}
            </RNView>
          </RNView>

          <RNView style={styles.inviteProgressCard}>
            <Text style={styles.inviteProgressEyebrow}>
              {planTier === 'premium' ? 'Referral Status' : 'Referral Progress'}
            </Text>
            <Text style={styles.inviteProgressTitle}>
              {planTier === 'premium'
                ? 'Premium is already active on this account'
                : `${inviteSummary?.referralCount || 0}/3 uses toward your next Premium month`}
            </Text>
            <Text style={styles.inviteProgressHint}>
              {rewardExpiryLabel
                ? `Referral Premium active until ${rewardExpiryLabel}.`
                : planTier === 'premium'
                  ? 'Your account already has Premium access.'
                  : `${inviteSummary?.referralsUntilNextReward || 3} more successful uses to unlock Premium.`}
            </Text>

            {planTier !== 'premium' ? (
              <RNView style={styles.progressTrack}>
                <RNView
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(((inviteSummary?.referralCount || 0) % 3 || 0) / 3 * 100, 100)}%` },
                  ]}
                />
              </RNView>
            ) : null}

            {planTier !== 'premium' ? (
              <>
                <Text style={styles.label}>Redeem Someone Else's Invite Code</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ABC123"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                  value={inviteCodeInput}
                  onChangeText={(value) => setInviteCodeInput(value.toUpperCase())}
                  editable={!inviteSummary?.referredByUserId && !applyingInviteCode}
                />
                <Text style={styles.inviteRedeemHint}>
                  {inviteSummary?.referredByUserId
                    ? `You already redeemed invite code ${inviteSummary.referredByCode || inviteCodeInput}.`
                    : 'Invite codes only work on new accounts and can be redeemed once per account.'}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.redeemButton,
                    (applyingInviteCode || Boolean(inviteSummary?.referredByUserId)) && styles.redeemButtonDisabled,
                  ]}
                  onPress={() => {
                    void handleApplyInviteCode();
                  }}
                  disabled={applyingInviteCode || Boolean(inviteSummary?.referredByUserId)}
                >
                  <Text style={styles.redeemButtonText}>
                    {applyingInviteCode ? 'Applying...' : 'Apply Invite Code'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </RNView>

          <Text style={styles.label}>Default Currency</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency.code}
                style={[styles.chip, currencyDefault === currency.code && styles.chipActive]}
                onPress={() => setCurrencyDefault(currency.code)}
              >
                <Text style={[styles.chipText, currencyDefault === currency.code && styles.chipTextActive]}>
                  {currency.code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Default Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {SUPPORTED_LANGUAGES.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[styles.chip, defaultLanguage === language.code && styles.chipActive]}
                onPress={() => {
                  setDefaultLanguage(language.code);
                  setLanguage(language.code);
                }}
              >
                <Text style={[styles.chipText, defaultLanguage === language.code && styles.chipTextActive]}>
                  {language.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Card>

        <TouchableOpacity
          disabled={loading || initializing}
          onPress={handleSave}
          style={[styles.saveButton, (loading || initializing) && styles.disabled]}
        >
          <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Profile'}</Text>
        </TouchableOpacity>
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
    paddingTop: 12,
    paddingBottom: 40,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  card: {
    padding: 20,
  },
  inlineNavRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    backgroundColor: 'transparent',
  },
  inlineNavButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineNavButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  avatarButton: {
    width: 112,
    height: 112,
    borderRadius: 56,
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    backgroundColor: '#E2E8F0',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#6366F1',
  },
  avatarBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  avatarActionButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  avatarActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  avatarRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  avatarRemoveButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  avatarHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  friendCodeCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  friendCodeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  friendCodeValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#0F172A',
  },
  friendCodeHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#475569',
  },
  friendCodeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  friendCodeButtonDisabled: {
    opacity: 0.45,
  },
  friendCodeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  friendCodeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    backgroundColor: 'transparent',
  },
  friendCodeRetryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  friendCodeRetryButtonText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '800',
  },
  inviteProgressCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  inviteProgressEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: '#C2410C',
  },
  inviteProgressTitle: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  inviteProgressHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: '#7C2D12',
  },
  progressTrack: {
    marginTop: 14,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#F97316',
  },
  inviteRedeemHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#9A3412',
  },
  redeemButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#0F172A',
  },
  redeemButtonDisabled: {
    opacity: 0.45,
  },
  redeemButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  chips: {
    marginTop: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  chipText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  webProfileCard: {
    padding: 22,
  },
  webAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'transparent',
  },
  webAvatarCopy: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  webFormCard: {
    flex: 1,
    minWidth: 320,
    padding: 22,
  },
  webInviteCard: {
    width: 340,
    padding: 22,
  },
  webCardTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
  },
  webCardBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    marginBottom: 14,
  },
  webInviteCode: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    color: '#4338CA',
    marginBottom: 14,
  },
  webPrimaryButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  webPrimaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  webSecondaryButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  webSecondaryButtonDisabled: {
    opacity: 0.45,
  },
  webSecondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  webHintText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
  },
  saveButton: {
    marginTop: 16,
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.7,
  },
});
