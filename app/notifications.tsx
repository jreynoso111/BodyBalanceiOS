import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View as RNView, Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { Screen, Card, Text } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';
import {
  DEFAULT_USER_PREFERENCES,
  getOrCreateUserPreferences,
  updateUserPreferences,
  UserPreferences,
} from '@/services/userPreferences';
import {
  clearAllLoanReminders,
  disablePushNotifications,
  getPushPermissionStatus,
  registerForPushNotificationsAsync,
} from '@/services/notificationService';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';

type ToggleKey = 'push_enabled' | 'email_enabled' | 'reminder_enabled' | 'marketing_enabled';

export default function NotificationsScreen() {
  const { user, initialized } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ToggleKey | null>(null);
  const [pushPermission, setPushPermission] = useState<string>('unknown');
  const [prefs, setPrefs] = useState<Omit<UserPreferences, 'user_id'>>({
    ...DEFAULT_USER_PREFERENCES,
  });

  useEffect(() => {
    if (!user?.id) return;
    void loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [prefResult, permissionStatus] = await Promise.all([
      getOrCreateUserPreferences(user.id),
      getPushPermissionStatus(),
    ]);
    const { data, error } = prefResult;
    setPushPermission(permissionStatus);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

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

  const togglePreference = async (key: ToggleKey) => {
    if (!user?.id) return;
    if (saving) return;

    const nextValue = !prefs[key];
    const previous = prefs;
    setSaving(key);
    setPrefs({ ...prefs, [key]: nextValue });

    if (key === 'push_enabled') {
      if (nextValue) {
        const token = await registerForPushNotificationsAsync({ requestPermission: true, userId: user.id });
        const permission = await getPushPermissionStatus();
        setPushPermission(permission);
        if (!token) {
          setPrefs(previous);
          setSaving(null);
          Alert.alert('Push notifications remain disabled', 'Permission was not granted.');
          return;
        }
      } else {
        await disablePushNotifications(user.id);
        if (prefs.reminder_enabled) {
          setPrefs((current) => ({ ...current, reminder_enabled: false }));
        }
      }
    }

    if (key === 'reminder_enabled') {
      if (nextValue && !prefs.push_enabled) {
        const token = await registerForPushNotificationsAsync({ requestPermission: true, userId: user.id });
        const permission = await getPushPermissionStatus();
        setPushPermission(permission);
        if (!token) {
          setPrefs(previous);
          setSaving(null);
          Alert.alert('Cannot enable reminders', 'Enable push notifications first.');
          return;
        }

        const pushPatch = await updateUserPreferences(user.id, { push_enabled: true });
        if (pushPatch.error || !pushPatch.data) {
          setPrefs(previous);
          setSaving(null);
          Alert.alert('Error', pushPatch.error?.message || 'Could not enable push notifications.');
          return;
        }

        setPrefs({
          push_enabled: pushPatch.data.push_enabled,
          email_enabled: pushPatch.data.email_enabled,
          reminder_enabled: pushPatch.data.reminder_enabled,
          biometric_enabled: pushPatch.data.biometric_enabled,
          marketing_enabled: pushPatch.data.marketing_enabled,
          preferred_currencies: pushPatch.data.preferred_currencies,
        });
      } else if (!nextValue) {
        await clearAllLoanReminders();
      }
    }

    const patch: Partial<Omit<UserPreferences, 'user_id' | 'updated_at'>> =
      key === 'push_enabled' && !nextValue
        ? { push_enabled: false, reminder_enabled: false }
        : { [key]: nextValue };

    const { data, error } = await updateUserPreferences(user.id, patch);
    if (error) {
      setPrefs(previous);
      setSaving(null);
      Alert.alert('Error', error.message);
      return;
    }

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
    setSaving(null);
  };

  if (Platform.OS === 'web') {
    if (initialized && !user) {
      return <Redirect href="/(auth)/login" />;
    }

    return (
      <WebAccountLayout
        eyebrow="Notifications"
        title="Choose how Buddy Balance should reach you."
        description="These preferences update the same notification settings used by the mobile app."
      >
        <Card style={styles.webCard}>
          <PreferenceRow
            title="Push Notifications"
            subtitle="On-device alerts for reminders on this phone"
            value={prefs.push_enabled}
            onChange={() => togglePreference('push_enabled')}
            disabled={!!saving}
          />
          <PreferenceRow
            title="Email Notifications"
            subtitle="Preference saved for future email delivery rollout"
            value={prefs.email_enabled}
            onChange={() => togglePreference('email_enabled')}
            disabled={!!saving}
          />
          <PreferenceRow
            title="Payment Reminders"
            subtitle="On-device reminder alerts before due dates"
            value={prefs.reminder_enabled}
            onChange={() => togglePreference('reminder_enabled')}
            disabled={!!saving}
          />
          <PreferenceRow
            title="Product Updates"
            subtitle="Preference saved for future feature announcements"
            value={prefs.marketing_enabled}
            onChange={() => togglePreference('marketing_enabled')}
            noBorder
            disabled={!!saving}
          />
        </Card>
        <Card style={styles.webStatusCard}>
          <Text style={styles.webStatusText}>{loading ? 'Loading preferences...' : `Push permission: ${pushPermission}`}</Text>
        </Card>
      </WebAccountLayout>
    );
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <PreferenceRow
            title="Push Notifications"
            subtitle="On-device alerts for reminders on this phone"
            value={prefs.push_enabled}
            onChange={() => togglePreference('push_enabled')}
            disabled={!!saving}
          />
          <PreferenceRow
            title="Email Notifications"
            subtitle="Preference saved for future email delivery rollout"
            value={prefs.email_enabled}
            onChange={() => togglePreference('email_enabled')}
            disabled={!!saving}
          />
          <PreferenceRow
            title="Payment Reminders"
            subtitle="On-device reminder alerts before due dates"
            value={prefs.reminder_enabled}
            onChange={() => togglePreference('reminder_enabled')}
            disabled={!!saving}
          />
          <PreferenceRow
            title="Product Updates"
            subtitle="Preference saved for future feature announcements"
            value={prefs.marketing_enabled}
            onChange={() => togglePreference('marketing_enabled')}
            noBorder
            disabled={!!saving}
          />
        </Card>
        {loading ? <Text style={styles.footerText}>Loading preferences...</Text> : null}
        {!loading ? (
          <Text style={styles.footerText}>
            Push Permission: {pushPermission}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function PreferenceRow({
  title,
  subtitle,
  value,
  onChange,
  noBorder = false,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: () => void;
  noBorder?: boolean;
  disabled?: boolean;
}) {
  return (
    <RNView style={[styles.row, noBorder && styles.noBorder]}>
      <RNView style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </RNView>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#CBD5E1', true: '#6366F1' }}
        thumbColor="#FFFFFF"
        disabled={disabled}
      />
    </RNView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 120,
    paddingBottom: 40,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  webCard: {
    padding: 0,
    overflow: 'hidden',
  },
  webStatusCard: {
    padding: 22,
  },
  webStatusText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  rowText: {
    flex: 1,
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  rowSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  footerText: {
    textAlign: 'center',
    marginTop: 14,
    color: '#64748B',
    fontSize: 12,
  },
});
