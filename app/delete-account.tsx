import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, TextInput, TouchableOpacity, View as RNView } from 'react-native';
import { Link, Redirect, Stack, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react-native';

import { Card, Screen, Text } from '@/components/Themed';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';
import { useAppTheme } from '@/hooks/useAppTheme';
import { deleteMyAccount } from '@/services/accountManagement';
import { clearPersistedAuthState, supabase } from '@/services/supabase';
import { getDeviceLanguage } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';

const CONFIRMATION_TEXT = 'DELETE';
const LAST_PROTECTED_PATH_KEY = 'last_protected_path';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const { initialized, user, setSession, setUser, setRole, setPlanTier, setLanguage } = useAuthStore();
  const [confirmation, setConfirmation] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const normalizedConfirmation = confirmation.trim().toUpperCase();
  const canDelete = normalizedConfirmation === CONFIRMATION_TEXT && !submitting;

  React.useEffect(() => {
    if (!user?.id) return;
    void AsyncStorage.setItem(LAST_PROTECTED_PATH_KEY, '/(tabs)/settings').catch(() => null);
  }, [user?.id]);

  const resetLocalSession = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    await clearPersistedAuthState();
    setSession(null);
    setUser(null);
    setRole(null);
    setPlanTier('free');
    setLanguage(getDeviceLanguage());
  };

  const handleDeleteAccount = async () => {
    if (!canDelete) {
      setFeedback('Type DELETE to confirm account deletion.');
      return;
    }

    const runDelete = async () => {
      try {
        setSubmitting(true);
        setFeedback(null);
        await deleteMyAccount(normalizedConfirmation);
        await resetLocalSession();
        router.replace('/');
      } catch (error: any) {
        setFeedback(error?.message || 'Could not delete your account right now.');
        if (Platform.OS !== 'web') {
          Alert.alert('Delete failed', error?.message || 'Could not delete your account right now.');
        }
      } finally {
        setSubmitting(false);
      }
    };

    if (Platform.OS === 'web') {
      await runDelete();
      return;
    }

    Alert.alert(
      'Delete account',
      'This permanently removes your Buddy Balance account, profile, support history, and your owned records. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => {
            void runDelete();
          },
        },
      ]
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)/settings');
  };

  const form = (
    <Card style={styles.card}>
      <RNView style={styles.warningBadge}>
        <AlertTriangle size={18} color="#B91C1C" />
        <Text style={styles.warningBadgeText}>Permanent action</Text>
      </RNView>

      <Text style={[styles.title, { color: theme.title }]}>Delete account</Text>
      <Text style={[styles.subtitle, { color: theme.secondaryText }]}>
        This permanently deletes your Buddy Balance account and signs you out on this device.
      </Text>

      <RNView style={styles.impactList}>
        <Text style={[styles.impactItem, { color: theme.secondaryText }]}>Your profile, preferences, and support history will be removed.</Text>
        <Text style={[styles.impactItem, { color: theme.secondaryText }]}>Your own records, payments, and invitations will be deleted.</Text>
        <Text style={[styles.impactItem, { color: theme.secondaryText }]}>Linked references in other accounts will be detached where possible.</Text>
        <Text style={[styles.impactItem, { color: theme.secondaryText }]}>Google Play purchases are not refunded automatically by deleting the account.</Text>
      </RNView>

      <Text style={[styles.label, { color: theme.secondaryText }]}>Type {CONFIRMATION_TEXT} to continue</Text>
      <RNView style={[styles.inputWrapper, { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder }]}>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRMATION_TEXT}
          placeholderTextColor={theme.tertiaryText}
          style={[styles.input, { color: theme.inputText }]}
        />
      </RNView>

      {feedback ? (
        <RNView style={[styles.feedbackBox, { backgroundColor: theme.feedbackErrorBackground, borderColor: theme.feedbackErrorBorder }]}>
          <Text style={[styles.feedbackText, { color: theme.feedbackErrorText }]}>{feedback}</Text>
        </RNView>
      ) : null}

      <TouchableOpacity
        onPress={() => void handleDeleteAccount()}
        disabled={!canDelete}
        style={[styles.deleteButton, !canDelete && styles.buttonDisabled]}
      >
        <Trash2 size={18} color="#FFFFFF" />
        <Text style={styles.deleteButtonText}>{submitting ? 'Deleting...' : 'Delete my account'}</Text>
      </TouchableOpacity>
    </Card>
  );

  if (initialized && !user) {
    return <Redirect href={Platform.OS === 'web' ? '/(auth)/login' : '/'} />;
  }

  return (
    <Screen style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        {Platform.OS === 'web' ? (
          <WebAccountLayout
            eyebrow="Account deletion"
            title="Delete this Buddy Balance account permanently."
            description="Use this only when you want the account and its owned app data removed. This action cannot be undone."
          >
            <Link href="/settings" asChild>
              <TouchableOpacity style={styles.webBackButton}>
                <Text style={styles.webBackButtonText}>Back to settings</Text>
              </TouchableOpacity>
            </Link>
            {form}
          </WebAccountLayout>
        ) : (
          <RNView style={styles.content}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <ArrowLeft size={20} color={theme.backButton} />
              <Text style={[styles.backText, { color: theme.backButton }]}>Back</Text>
            </TouchableOpacity>
            {form}
          </RNView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backText: {
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    padding: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF7F7',
  },
  webBackButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: '#FFFFFF',
  },
  webBackButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
    marginBottom: 16,
  },
  warningBadgeText: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  impactList: {
    gap: 8,
    marginBottom: 20,
  },
  impactItem: {
    fontSize: 14,
    lineHeight: 21,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputWrapper: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    paddingVertical: 16,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  feedbackBox: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  deleteButton: {
    marginTop: 18,
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
