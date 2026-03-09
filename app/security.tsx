import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View as RNView, Platform } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { Screen, Card, Text } from '@/components/Themed';
import { useAuthStore } from '@/store/authStore';
import { getPasswordPolicyMessage, isStrongPassword } from '@/services/passwordPolicy';
import { supabase } from '@/services/supabase';
import { getOrCreateUserPreferences, updateUserPreferences } from '@/services/userPreferences';
import { setCachedBiometricLockEnabled } from '@/services/appLock';
import { getBiometricCapability, promptBiometricVerification } from '@/services/biometrics';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';

export default function SecurityScreen() {
  const { user, initialized } = useAuthStore();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('biometrics');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void initializeSecuritySettings();
  }, [user?.id]);

  const initializeSecuritySettings = async () => {
    if (!user?.id) return;

    const [{ data, error }, capability] = await Promise.all([
      getOrCreateUserPreferences(user.id),
      getBiometricCapability(),
    ]);

    setBiometricSupported(capability.hasHardware);
    setBiometricEnrolled(capability.isEnrolled);
    setBiometricLabel(capability.label);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    const savedPreference = Boolean(data?.biometric_enabled);
    await setCachedBiometricLockEnabled(user.id, savedPreference && capability.hasHardware && capability.isEnrolled);
    if (savedPreference && (!capability.hasHardware || !capability.isEnrolled)) {
      const { error: disableError } = await updateUserPreferences(user.id, { biometric_enabled: false });
      if (disableError) {
        Alert.alert('Error', disableError.message);
      }
      await setCachedBiometricLockEnabled(user.id, false);
      setBiometricEnabled(false);
      return;
    }

    setBiometricEnabled(savedPreference);
  };

  const biometricSubtitle = !biometricSupported
    ? 'Biometric hardware is not available on this device.'
    : !biometricEnrolled
      ? `No ${biometricLabel} is enrolled on this device. Add it in system settings first.`
      : `Use ${biometricLabel} for secure verification in the app.`;

  const mapBiometricError = (errorCode?: string) => {
    if (!errorCode) return 'Biometric verification failed.';
    if (errorCode === 'user_cancel' || errorCode === 'system_cancel' || errorCode === 'app_cancel') {
      return 'Biometric verification was canceled.';
    }
    if (errorCode === 'not_enrolled') {
      return `No ${biometricLabel} is enrolled on this device.`;
    }
    if (errorCode === 'lockout') {
      return 'Biometrics are temporarily locked. Use device passcode and try again.';
    }
    if (errorCode === 'not_available') {
      return 'Biometric authentication is not available on this device.';
    }
    if (errorCode === 'passcode_not_set') {
      return 'Set a device passcode before enabling biometrics.';
    }
    return 'Biometric verification failed. Please try again.';
  };

  const enableBiometric = async () => {
    if (!user?.id) return;
    setBiometricBusy(true);

    try {
      const capability = await getBiometricCapability();
      setBiometricSupported(capability.hasHardware);
      setBiometricEnrolled(capability.isEnrolled);
      setBiometricLabel(capability.label);

      if (!capability.hasHardware) {
        Alert.alert('Unavailable', 'Biometric hardware is not available on this device.');
        return;
      }

      if (!capability.isEnrolled) {
        Alert.alert(
          'Not enrolled',
          `No ${capability.label} is enrolled on this device. Add it in system settings first.`
        );
        return;
      }

      const authResult = await promptBiometricVerification(capability.label);
      if (!authResult.success) {
        Alert.alert('Verification failed', mapBiometricError((authResult as any).error));
        return;
      }

      const { error } = await updateUserPreferences(user.id, { biometric_enabled: true });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }

      await setCachedBiometricLockEnabled(user.id, true);
      setBiometricEnabled(true);
      Alert.alert('Success', `${capability.label} has been enabled.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred while enabling biometrics.');
    } finally {
      setBiometricBusy(false);
    }
  };

  const disableBiometric = async () => {
    if (!user?.id) return;
    setBiometricBusy(true);
    try {
      const { error } = await updateUserPreferences(user.id, { biometric_enabled: false });
      if (error) {
        Alert.alert('Error', error.message);
        return;
      }
      await setCachedBiometricLockEnabled(user.id, false);
      setBiometricEnabled(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred while disabling biometrics.');
    } finally {
      setBiometricBusy(false);
    }
  };

  const onToggleBiometric = async () => {
    if (biometricBusy) return;

    if (biometricEnabled) {
      await disableBiometric();
      return;
    }

    await enableBiometric();
  };

  const onTestBiometric = async () => {
    if (biometricBusy) return;
    if (!biometricSupported || !biometricEnrolled) {
      Alert.alert('Unavailable', biometricSubtitle);
      return;
    }

    setBiometricBusy(true);
    try {
      const result = await promptBiometricVerification(biometricLabel);
      if (!result.success) {
        Alert.alert('Verification failed', mapBiometricError((result as any).error));
        return;
      }

      Alert.alert('Success', `${biometricLabel} verification successful.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An unexpected error occurred while verifying.');
    } finally {
      setBiometricBusy(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!isStrongPassword(newPassword)) {
      Alert.alert('Error', getPasswordPolicyMessage());
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Success', 'Password updated');
  };

  const handleGlobalSignOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Success', 'Signed out from all sessions');
  };

  if (Platform.OS === 'web') {
    if (initialized && !user) {
      return <Redirect href="/(auth)/login" />;
    }

    return (
      <WebAccountLayout
        eyebrow="Security"
        title="Security controls for the same Buddy Balance account."
        description="Change password, review biometric lock state, and sign out other sessions from a web-friendly account surface."
      >
        <Card style={styles.webSecurityCard}>
          <RNView style={styles.row}>
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle}>Biometric Lock</Text>
              <Text style={styles.rowSubtitle}>{biometricSubtitle}</Text>
            </RNView>
            <Switch
              value={biometricEnabled}
              onValueChange={onToggleBiometric}
              disabled={biometricBusy}
              trackColor={{ false: '#CBD5E1', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </RNView>

          <TouchableOpacity
            style={[styles.verifyButton, biometricBusy && styles.verifyButtonDisabled]}
            onPress={onTestBiometric}
            disabled={biometricBusy}
          >
            <Text style={styles.verifyButtonText}>{biometricBusy ? 'Checking...' : `Test ${biometricLabel}`}</Text>
          </TouchableOpacity>
        </Card>

        <RNView style={styles.webSecurityGrid}>
          <Card style={styles.webSecurityForm}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <TextInput
              secureTextEntry
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#94A3B8"
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              secureTextEntry
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#94A3B8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handlePasswordUpdate} disabled={savingPassword}>
              <Text style={styles.primaryButtonText}>{savingPassword ? 'Updating...' : 'Update Password'}</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.webSecurityForm}>
            <Text style={styles.sectionTitle}>Session Control</Text>
            <Text style={styles.rowSubtitle}>
              If another browser or device still has access, force a global sign out for all active sessions tied to this account.
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleGlobalSignOut}>
              <Text style={styles.secondaryButtonText}>Sign Out All Devices</Text>
            </TouchableOpacity>
          </Card>
        </RNView>
      </WebAccountLayout>
    );
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ title: 'Security' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <RNView style={styles.row}>
            <RNView style={styles.rowText}>
              <Text style={styles.rowTitle}>Biometric Lock</Text>
              <Text style={styles.rowSubtitle}>{biometricSubtitle}</Text>
            </RNView>
            <Switch
              value={biometricEnabled}
              onValueChange={onToggleBiometric}
              disabled={biometricBusy}
              trackColor={{ false: '#CBD5E1', true: '#6366F1' }}
              thumbColor="#FFFFFF"
            />
          </RNView>

          <TouchableOpacity
            style={[
              styles.verifyButton,
              biometricBusy && styles.verifyButtonDisabled
            ]}
            onPress={onTestBiometric}
            disabled={biometricBusy}
          >
            <Text style={styles.verifyButtonText}>
              {biometricBusy ? 'Checking...' : `Test ${biometricLabel}`}
            </Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <TextInput
            secureTextEntry
            style={styles.input}
            placeholder="New password"
            placeholderTextColor="#94A3B8"
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
          />
          <TextInput
            secureTextEntry
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#94A3B8"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.primaryButton} onPress={handlePasswordUpdate} disabled={savingPassword}>
            <Text style={styles.primaryButtonText}>{savingPassword ? 'Updating...' : 'Update Password'}</Text>
          </TouchableOpacity>
        </Card>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleGlobalSignOut}>
          <Text style={styles.secondaryButtonText}>Sign Out All Devices</Text>
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
    paddingTop: 120,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    padding: 16,
  },
  webSecurityCard: {
    padding: 18,
  },
  webSecurityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  webSecurityForm: {
    flex: 1,
    minWidth: 320,
    padding: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  rowText: {
    flex: 1,
    marginRight: 10,
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
  verifyButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  verifyButtonDisabled: {
    opacity: 0.45,
  },
  verifyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  sectionTitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '800',
    marginBottom: 10,
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
    marginBottom: 10,
  },
  primaryButton: {
    marginTop: 4,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  secondaryButtonText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 15,
  },
});
