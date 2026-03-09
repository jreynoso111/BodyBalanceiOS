import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, Platform, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { usePathname } from 'expo-router';

import { Card, Text } from '@/components/Themed';
import { getCachedBiometricLockEnabled, setCachedBiometricLockEnabled } from '@/services/appLock';
import { getBiometricCapability, promptBiometricVerification } from '@/services/biometrics';
import { supabase } from '@/services/supabase';
import { getOrCreateUserPreferences } from '@/services/userPreferences';
import { useAuthStore } from '@/store/authStore';

function mapBiometricError(errorCode?: string, label?: string) {
  if (!errorCode) return 'Biometric verification failed.';
  if (errorCode === 'user_cancel' || errorCode === 'system_cancel' || errorCode === 'app_cancel') {
    return 'Verification was canceled.';
  }
  if (errorCode === 'not_enrolled') {
    return `No ${label || 'biometrics'} is enrolled on this device.`;
  }
  if (errorCode === 'lockout') {
    return 'Biometrics are temporarily locked. Use your device passcode and try again.';
  }
  if (errorCode === 'not_available') {
    return 'Biometric authentication is not available on this device.';
  }
  if (errorCode === 'passcode_not_set') {
    return 'Set a device passcode before using biometric lock.';
  }
  return 'Biometric verification failed. Please try again.';
}

export function AppBiometricGate() {
  const pathname = usePathname();
  const { initialized, session } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [requiresUnlock, setRequiresUnlock] = useState(false);
  const [shouldPrompt, setShouldPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('biometrics');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const hasResolvedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;

    const syncLockState = async () => {
      if (!initialized) return;

      const userId = session?.user?.id;
      if (!userId) {
        if (!mounted) return;
        hasResolvedRef.current = false;
        setLockEnabled(false);
        setRequiresUnlock(false);
        setShouldPrompt(false);
        setErrorMessage(null);
        setLoading(false);
        return;
      }

      const cachedEnabled = await getCachedBiometricLockEnabled(userId);
      if (!mounted) return;

      setLoading(!hasResolvedRef.current || cachedEnabled);

      if (cachedEnabled) {
        setLockEnabled(true);
        setRequiresUnlock(true);
        setShouldPrompt(true);
      }

      const [preferenceResult, capability] = await Promise.all([
        getOrCreateUserPreferences(userId),
        getBiometricCapability(),
      ]);

      if (!mounted) return;

      if (preferenceResult.error) {
        setLabel(capability.label);
        setLoading(false);
        return;
      }

      const remoteEnabled =
        Boolean(preferenceResult.data?.biometric_enabled) &&
        capability.hasHardware &&
        capability.isEnrolled;

      await setCachedBiometricLockEnabled(userId, remoteEnabled);
      hasResolvedRef.current = true;

      setLabel(capability.label);
      setLockEnabled(remoteEnabled);
      setRequiresUnlock(remoteEnabled);
      setShouldPrompt(remoteEnabled);
      setErrorMessage(null);
      setLoading(false);
    };

    void syncLockState();

    return () => {
      mounted = false;
    };
  }, [initialized, pathname, session?.user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (
        session?.user?.id &&
        lockEnabled &&
        (previousState === 'inactive' || previousState === 'background') &&
        nextState === 'active'
      ) {
        setRequiresUnlock(true);
        setShouldPrompt(true);
        setErrorMessage(null);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [lockEnabled, session?.user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!session?.user?.id || !lockEnabled || !requiresUnlock || !shouldPrompt || busy) return;

    let cancelled = false;

    const runPrompt = async () => {
      setBusy(true);
      setShouldPrompt(false);

      try {
        const capability = await getBiometricCapability();
        if (!capability.hasHardware || !capability.isEnrolled) {
          await setCachedBiometricLockEnabled(session.user.id, false);
          if (cancelled) return;
          setLabel(capability.label);
          setLockEnabled(false);
          setRequiresUnlock(false);
          setErrorMessage(null);
          return;
        }

        setLabel(capability.label);
        const result = await promptBiometricVerification(capability.label);
        if (cancelled) return;

        if (result.success) {
          setRequiresUnlock(false);
          setErrorMessage(null);
          return;
        }

        setErrorMessage(mapBiometricError((result as any).error, capability.label));
      } catch (error: any) {
        if (cancelled) return;
        setErrorMessage(error?.message || 'Could not verify your identity right now.');
      } finally {
        if (!cancelled) {
          setBusy(false);
        }
      }
    };

    void runPrompt();

    return () => {
      cancelled = true;
    };
  }, [busy, lockEnabled, requiresUnlock, session?.user?.id, shouldPrompt]);

  if (Platform.OS === 'web') return null;
  if (!initialized || !session?.user?.id) return null;
  if (!loading && !requiresUnlock) return null;

  return (
    <RNView style={styles.overlay}>
      <Card style={styles.card}>
        {loading ? <ActivityIndicator size="small" color="#6366F1" /> : null}
        <Text style={styles.title}>{loading ? 'Checking security' : 'Unlock Buddy Balance'}</Text>
        <Text style={styles.subtitle}>
          {loading
            ? 'Loading your security settings...'
            : errorMessage || `Verify with ${label} to continue.`}
        </Text>

        {!loading ? (
          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={() => {
              if (busy) return;
              setShouldPrompt(true);
              setErrorMessage(null);
            }}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{busy ? 'Checking...' : `Unlock with ${label}`}</Text>
          </TouchableOpacity>
        ) : null}

        {!loading ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              void supabase.auth.signOut();
            }}
          >
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </TouchableOpacity>
        ) : null}
      </Card>
    </RNView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248, 250, 252, 0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 18,
  },
  button: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
  },
});
