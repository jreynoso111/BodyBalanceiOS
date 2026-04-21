import React, { useCallback, useState } from 'react';
import { Alert, Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';

import { Card, Screen, Text, View } from '@/components/Themed';
import { ColorPalettePicker, ThemePreferencePicker } from '@/components/ThemeControls';
import { CURRENCIES } from '@/constants/Currencies';
import { AppLanguage, getDeviceLanguage, normalizeLanguage, SUPPORTED_LANGUAGES } from '@/constants/i18n';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useI18n } from '@/hooks/useI18n';
import { supabase } from '@/services/supabase';
import { DEFAULT_USER_PREFERENCES, getOrCreateUserPreferences, sanitizePreferredCurrencies, updateUserPreferences } from '@/services/userPreferences';
import { useAuthStore } from '@/store/authStore';
import { ArrowLeft, House } from 'lucide-react-native';
import { WebAccountLayout } from '@/components/website/WebAccountLayout';

const isMissingDefaultLanguageColumn = (message?: string) =>
  String(message || '').toLowerCase().includes('default_language');

export default function PreferencesScreen() {
  const { user, initialized, language, setLanguage } = useAuthStore();
  const { t } = useI18n();
  const { theme, colorScheme } = useAppTheme();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currencyDefault, setCurrencyDefault] = useState('USD');
  const [defaultLanguage, setDefaultLanguage] = useState<AppLanguage>(language || getDeviceLanguage());
  const [preferredCurrencies, setPreferredCurrencies] = useState<string[]>(DEFAULT_USER_PREFERENCES.preferred_currencies);

  const loadPreferences = useCallback(async () => {
    if (!user?.id) return;

    let { data, error } = await supabase
      .from('profiles')
      .select('currency_default, default_language')
      .eq('id', user.id)
      .maybeSingle();

    if (error && isMissingDefaultLanguageColumn(error.message)) {
      const fallback = await supabase
        .from('profiles')
        .select('currency_default')
        .eq('id', user.id)
        .maybeSingle();
      data = fallback.data as any;
      error = fallback.error as any;
    }

    if (error) {
      console.error('preferences profile load failed:', error.message);
    }

    const prefsResult = await getOrCreateUserPreferences(user.id);
    if (prefsResult.error) {
      console.error('preferences load failed:', prefsResult.error.message);
    }

    setCurrencyDefault(String((data as any)?.currency_default || 'USD').trim().toUpperCase() || 'USD');
    setDefaultLanguage(normalizeLanguage((data as any)?.default_language, language || getDeviceLanguage()));
    setPreferredCurrencies(sanitizePreferredCurrencies(prefsResult.data?.preferred_currencies));
  }, [language, user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void loadPreferences();
    }, [loadPreferences, user?.id])
  );

  const togglePreferredCurrency = (code: string) => {
    setPreferredCurrencies((current) => {
      const normalized = code.toUpperCase();
      if (current.includes(normalized)) {
        if (current.length === 1) return current;
        return current.filter((value) => value !== normalized);
      }

      return sanitizePreferredCurrencies([...current, normalized]);
    });
  };

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert(t('Error'), t('User not found'));
      return;
    }

    setSaving(true);
    let languageSavedWithFallback = false;

    try {
      const profilePatch: Record<string, any> = {
        currency_default: String(currencyDefault || 'USD').trim().toUpperCase() || 'USD',
        default_language: defaultLanguage,
        updated_at: new Date().toISOString(),
      };

      let { error } = await supabase.from('profiles').update(profilePatch).eq('id', user.id);

      if (error && isMissingDefaultLanguageColumn(error.message)) {
        languageSavedWithFallback = true;
        const fallback = await supabase
          .from('profiles')
          .update({
            currency_default: profilePatch.currency_default,
            updated_at: profilePatch.updated_at,
          })
          .eq('id', user.id);
        error = fallback.error as any;
      }

      if (error) {
        throw error;
      }

      const { error: prefsError } = await updateUserPreferences(user.id, {
        preferred_currencies: sanitizePreferredCurrencies(preferredCurrencies),
      });

      if (prefsError) {
        throw prefsError;
      }

      if (!languageSavedWithFallback) {
        setLanguage(defaultLanguage);
      }

      Alert.alert(
        t('Success'),
        languageSavedWithFallback
          ? t('Preferences updated. Run the latest Supabase migration to persist: {fields}.', {
              fields: t('Default Language'),
            })
          : t('Preferences updated')
      );
    } catch (error: any) {
      Alert.alert(t('Error'), error?.message || t('Could not update preferences.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    try {
      await loadPreferences();
    } finally {
      setRefreshing(false);
    }
  };

  if (initialized && !user) {
    return <Redirect href="/" />;
  }

  if (Platform.OS === 'web') {
    return (
      <WebAccountLayout
        eyebrow={t('Preferences')}
        title={t('Manage app defaults and appearance.')}
        description={t('Use preferences for language, currency choices, and how Buddy Balance looks on this device.')}
      >
        <View style={styles.webGrid}>
          <Card style={styles.webCard}>
            <Text style={[styles.sectionTitle, { color: theme.title }]}>{t('Defaults')}</Text>
            <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>{t('These options affect how the app feels and which currencies are easiest to use.')}</Text>

            <Text style={[styles.label, { color: theme.secondaryText }]}>{t('Default Language')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {SUPPORTED_LANGUAGES.map((option) => (
                <TouchableOpacity
                  key={option.code}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                    defaultLanguage === option.code && styles.chipActive,
                    defaultLanguage === option.code && { backgroundColor: theme.tintSoft, borderColor: theme.tintBorder },
                  ]}
                  onPress={() => setDefaultLanguage(option.code)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: theme.secondaryText },
                    defaultLanguage === option.code && styles.chipTextActive,
                    defaultLanguage === option.code && { color: theme.tint },
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: theme.secondaryText }]}>{t('Default Currency')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {CURRENCIES.map((currency) => (
                <TouchableOpacity
                  key={currency.code}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                    currencyDefault === currency.code && styles.chipActive,
                    currencyDefault === currency.code && { backgroundColor: theme.tintSoft, borderColor: theme.tintBorder },
                  ]}
                  onPress={() => setCurrencyDefault(currency.code)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: theme.secondaryText },
                    currencyDefault === currency.code && styles.chipTextActive,
                    currencyDefault === currency.code && { color: theme.tint },
                  ]}>{currency.code}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: theme.secondaryText }]}>{t('Preferred Currencies')}</Text>
            <Text style={[styles.helperText, { color: theme.secondaryText }]}>{t('Choose the currencies you want to keep handy when creating or reviewing records.')}</Text>
            <RNView style={styles.multiSelectWrap}>
              {CURRENCIES.map((currency) => {
                const active = preferredCurrencies.includes(currency.code);
                return (
                  <TouchableOpacity
                    key={`preferred-${currency.code}`}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                      active && styles.chipActive,
                      active && { backgroundColor: theme.tintSoft, borderColor: theme.tintBorder },
                    ]}
                    onPress={() => togglePreferredCurrency(currency.code)}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: theme.secondaryText },
                      active && styles.chipTextActive,
                      active && { color: theme.tint },
                    ]}>{currency.code}</Text>
                  </TouchableOpacity>
                );
              })}
            </RNView>
          </Card>

          <Card style={styles.webCard}>
            <ThemePreferencePicker />
            <RNView style={styles.appearanceSpacer} />
            <ColorPalettePicker />
          </Card>
        </View>

        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.primaryButton }]} onPress={() => void handleSave()} disabled={saving}>
          <Text style={styles.primaryButtonText}>{saving ? t('Saving...') : t('Save Preferences')}</Text>
        </TouchableOpacity>
      </WebAccountLayout>
    );
  }

  return (
    <Screen style={styles.container} safeAreaEdges={['top', 'left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          title: t('Preferences'),
          headerTransparent: false,
          headerStyle: {
            backgroundColor: theme.navigation.card,
          },
          headerLeft: () => (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.navigation.card, borderColor: theme.navigation.border }]}
              onPress={() => router.replace('/(tabs)/settings')}
            >
              <ArrowLeft size={20} color={theme.navigation.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: theme.navigation.card, borderColor: theme.navigation.border }]}
              onPress={() => router.replace('/(tabs)')}
            >
              <House size={19} color={theme.navigation.text} />
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
          <TouchableOpacity
            style={[styles.inlineNavButton, { backgroundColor: theme.navigation.card, borderColor: theme.navigation.border }]}
            onPress={() => router.replace('/(tabs)/settings')}
          >
            <ArrowLeft size={16} color={theme.navigation.text} />
            <Text style={[styles.inlineNavButtonText, { color: theme.navigation.text }]}>{t('Back to settings')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.inlineNavButton, { backgroundColor: theme.navigation.card, borderColor: theme.navigation.border }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <House size={16} color={theme.navigation.text} />
            <Text style={[styles.inlineNavButtonText, { color: theme.navigation.text }]}>{t('Home')}</Text>
          </TouchableOpacity>
        </RNView>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, { color: theme.title }]}>{t('Language')}</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>{t('Set the language Buddy Balance should prioritize across the app.')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {SUPPORTED_LANGUAGES.map((option) => (
              <TouchableOpacity
                key={option.code}
                style={[
                  styles.chip,
                  { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                  defaultLanguage === option.code && styles.chipActive,
                  defaultLanguage === option.code && { backgroundColor: theme.tintSoft, borderColor: theme.tintBorder },
                ]}
                onPress={() => setDefaultLanguage(option.code)}
              >
                <Text style={[
                  styles.chipText,
                  { color: theme.secondaryText },
                  defaultLanguage === option.code && styles.chipTextActive,
                  defaultLanguage === option.code && { color: theme.tint },
                ]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.sectionTitle, { color: theme.title }]}>{t('Currency')}</Text>
          <Text style={[styles.sectionHint, { color: theme.secondaryText }]}>{t('Choose your default currency and keep your most-used currencies easy to reach.')}</Text>
          <Text style={[styles.label, { color: theme.secondaryText }]}>{t('Default Currency')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {CURRENCIES.map((currency) => (
              <TouchableOpacity
                key={currency.code}
                style={[
                  styles.chip,
                  { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                  currencyDefault === currency.code && styles.chipActive,
                  currencyDefault === currency.code && { backgroundColor: theme.tintSoft, borderColor: theme.tintBorder },
                ]}
                onPress={() => setCurrencyDefault(currency.code)}
              >
                <Text style={[
                  styles.chipText,
                  { color: theme.secondaryText },
                  currencyDefault === currency.code && styles.chipTextActive,
                  currencyDefault === currency.code && { color: theme.tint },
                ]}>{currency.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: theme.secondaryText }]}>{t('Preferred Currencies')}</Text>
          <RNView style={styles.multiSelectWrap}>
            {CURRENCIES.map((currency) => {
              const active = preferredCurrencies.includes(currency.code);
              return (
                <TouchableOpacity
                  key={`mobile-preferred-${currency.code}`}
                  style={[
                    styles.chip,
                    { backgroundColor: theme.inputBackground, borderColor: theme.inputBorder },
                    active && styles.chipActive,
                    active && { backgroundColor: theme.tintSoft, borderColor: theme.tintBorder },
                  ]}
                  onPress={() => togglePreferredCurrency(currency.code)}
                >
                  <Text style={[
                    styles.chipText,
                    { color: theme.secondaryText },
                    active && styles.chipTextActive,
                    active && { color: theme.tint },
                  ]}>{currency.code}</Text>
                </TouchableOpacity>
              );
            })}
          </RNView>

          <RNView style={styles.appearanceSection}>
            <ThemePreferencePicker
              title={t('Appearance')}
              description={t('Choose whether Buddy Balance stays light, dark, or follows the system on this device.')}
            />
            <RNView style={styles.appearanceSpacer} />
            <ColorPalettePicker
              description={t('Pick the accent palette you want the app to use for this account on this device.')}
            />
          </RNView>
        </Card>

        <TouchableOpacity
          disabled={saving}
          onPress={() => void handleSave()}
          style={[styles.primaryButton, { backgroundColor: theme.primaryButton }, saving && styles.disabled]}
        >
          <Text style={styles.primaryButtonText}>{saving ? t('Saving...') : t('Save Preferences')}</Text>
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
  },
  card: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#64748B',
    marginBottom: 10,
  },
  chips: {
    marginBottom: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 10,
    marginBottom: 10,
  },
  chipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  chipTextActive: {
    color: '#4F46E5',
  },
  multiSelectWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'transparent',
  },
  appearanceSection: {
    marginTop: 20,
    backgroundColor: 'transparent',
  },
  appearanceSpacer: {
    height: 18,
    backgroundColor: 'transparent',
  },
  primaryButton: {
    marginTop: 18,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.6,
  },
  webGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  webCard: {
    flex: 1,
    minWidth: 320,
    padding: 22,
  },
});
