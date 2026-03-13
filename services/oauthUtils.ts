export function mapGoogleOAuthError(rawMessage?: string): string {
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

export function readOAuthParam(url: string, key: string): string | null {
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
