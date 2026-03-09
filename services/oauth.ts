import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { waitForAuthSession } from '@/services/authSession';
import { supabase } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

export type GoogleAuthStatus = 'success' | 'redirect' | 'canceled' | 'error';

export interface GoogleAuthResult {
  status: GoogleAuthStatus;
  message?: string;
}

export function isGoogleOAuthEnabledForBuild() {
  return String(process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH || '').toLowerCase() === 'true';
}

export function isGoogleOAuthAvailable() {
  return !(Constants.appOwnership === 'expo' && Platform.OS !== 'web');
}

export function getGoogleOAuthUnavailableReason() {
  if (!isGoogleOAuthEnabledForBuild()) {
    return 'Google sign in is disabled for this build until the provider is configured in Supabase and Google Cloud.';
  }
  if (isGoogleOAuthAvailable()) return null;
  return 'Google sign in is not available inside Expo Go. Use a development build or the production app for Google authentication.';
}

function mapGoogleOAuthError(rawMessage?: string): string {
  const message = (rawMessage || '').trim();
  const normalized = message.toLowerCase();

  if (normalized.includes('provider is not enabled') || normalized.includes('unsupported provider')) {
    return 'Google sign-in is not enabled in Supabase yet. Enable Google in Auth Providers and add a valid Google Client ID/Secret.';
  }

  if (normalized.includes('invalid redirect') || normalized.includes('redirect_uri_mismatch')) {
    return 'Google sign-in redirect URL is not configured correctly. Verify your Supabase Auth redirect URLs and Google OAuth redirect URIs.';
  }

  if (normalized.includes('invalid client') || normalized.includes('client id')) {
    return 'Google OAuth client configuration is invalid. Verify the Google Client ID and Client Secret in Supabase Auth Providers.';
  }

  return message || 'Google sign in failed. Please try again.';
}

function readParam(url: string, key: string): string | null {
  try {
    const parsed = new URL(url);
    const queryValue = parsed.searchParams.get(key);
    if (queryValue) return queryValue;

    const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
    if (!hash) return null;
    const hashParams = new URLSearchParams(hash);
    return hashParams.get(key);
  } catch {
    return null;
  }
}

function getGoogleRedirectUrl() {
  const isExpoGo = Constants.appOwnership === 'expo';
  const appScheme =
    Constants.expoConfig?.scheme ||
    (Constants as any).manifest2?.extra?.expoClient?.scheme ||
    (Constants as any).manifest?.scheme ||
    'buddybalance';
  if (Platform.OS === 'web' || isExpoGo) {
    return Linking.createURL('auth/callback');
  }

  return Linking.createURL('auth/callback', {
    scheme: appScheme,
  });
}

export async function completeOAuthFromUrl(url: string): Promise<GoogleAuthResult> {
  const code = readParam(url, 'code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const existingSession = await waitForAuthSession({ timeoutMs: 1000, intervalMs: 150 });
      if (existingSession) {
        return { status: 'success' };
      }
      return { status: 'error', message: mapGoogleOAuthError(error.message) };
    }

    await waitForAuthSession({ timeoutMs: 3000, intervalMs: 150 });
    return { status: 'success' };
  }

  const accessToken = readParam(url, 'access_token');
  const refreshToken = readParam(url, 'refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      const existingSession = await waitForAuthSession({ timeoutMs: 1000, intervalMs: 150 });
      if (existingSession) {
        return { status: 'success' };
      }
      return { status: 'error', message: mapGoogleOAuthError(error.message) };
    }

    await waitForAuthSession({ timeoutMs: 3000, intervalMs: 150 });
    return { status: 'success' };
  }

  const oauthError = readParam(url, 'error_description') || readParam(url, 'error');
  if (oauthError) {
    return { status: 'error', message: mapGoogleOAuthError(oauthError) };
  }

  const existingSession = await waitForAuthSession({ timeoutMs: 1000, intervalMs: 150 });
  if (existingSession) {
    return { status: 'success' };
  }

  return { status: 'error', message: 'Could not complete Google authentication.' };
}

export async function signInWithGoogle(): Promise<GoogleAuthResult> {
  const unavailableReason = getGoogleOAuthUnavailableReason();
  if (unavailableReason) {
    return { status: 'error', message: unavailableReason };
  }

  const redirectTo = getGoogleRedirectUrl();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });

    if (error) {
      return { status: 'error', message: mapGoogleOAuthError(error.message) };
    }

    return { status: 'redirect' };
  }

  let handledUrl: string | null = null;
  const subscription = Linking.addEventListener('url', (event) => {
    handledUrl = event.url;
    void WebBrowser.dismissBrowser().catch(() => undefined);
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    subscription.remove();
    return { status: 'error', message: mapGoogleOAuthError(error.message) };
  }

  if (!data?.url) {
    subscription.remove();
    return { status: 'error', message: 'Could not start Google authentication.' };
  }

  try {
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    const callbackUrl = result.type === 'success' && result.url ? result.url : handledUrl;

    if (callbackUrl) {
      return completeOAuthFromUrl(callbackUrl);
    }

    const existingSession = await waitForAuthSession({ timeoutMs: 1500, intervalMs: 150 });
    if (existingSession) {
      return { status: 'success' };
    }

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { status: 'canceled', message: 'Google sign in was canceled.' };
    }

    return { status: 'redirect' };
  } finally {
    subscription.remove();
  }
}
