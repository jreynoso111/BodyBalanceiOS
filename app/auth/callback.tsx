import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { Screen, Card, Text } from '@/components/Themed';
import { waitForAuthSession } from '@/services/authSession';
import { completeOAuthFromUrl } from '@/services/oauth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const urlFromLinking = Linking.useURL();
  const searchParams = useLocalSearchParams<Record<string, string | string[]>>();
  const [statusText, setStatusText] = useState('Completing Google sign in...');
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);

  const callbackUrlFromParams = useMemo(() => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === 'string') {
        params.append(key, value);
        continue;
      }

      if (Array.isArray(value)) {
        value.forEach((item) => params.append(key, item));
      }
    }

    const query = params.toString();
    return query ? `buddybalance://auth/callback?${query}` : null;
  }, [searchParams]);

  const initialUrl = useMemo(() => {
    if (urlFromLinking) return urlFromLinking;
    if (callbackUrlFromParams) return callbackUrlFromParams;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.href;
    }
    return null;
  }, [callbackUrlFromParams, urlFromLinking]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!initialUrl) {
        if (!mounted) return;
        setFailed(true);
        setStatusText('Missing callback data. Please try again.');
        return;
      }

      const result = await completeOAuthFromUrl(initialUrl);
      if (!mounted) return;

      if (result.status === 'success') {
        const session = await waitForAuthSession({ timeoutMs: 5000, intervalMs: 150 });
        if (!mounted) return;

        if (!session) {
          setFailed(true);
          setStatusText('Google sign in finished, but the session was not saved. Please try again.');
          return;
        }

        setCompleted(true);
        setStatusText('Google account linked successfully.');
        router.replace('/(tabs)');
        return;
      }

      setFailed(true);
      setStatusText(result.message || 'Google sign in failed. Please try again.');
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [initialUrl, router]);

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <RNView style={styles.content}>
        <Card style={styles.card}>
          {!completed && !failed ? <ActivityIndicator size="small" color="#6366F1" /> : null}
          <Text style={styles.title}>{failed ? 'Authentication failed' : 'Google authentication'}</Text>
          <Text style={styles.subtitle}>{statusText}</Text>

          {failed ? (
            <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.buttonText}>Back to login</Text>
            </TouchableOpacity>
          ) : null}
        </Card>
      </RNView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  button: {
    marginTop: 4,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
