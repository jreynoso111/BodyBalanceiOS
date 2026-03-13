import { mapGoogleOAuthError, readOAuthParam } from '@/services/oauthUtils';

describe('oauth utils', () => {
  it('maps common provider and redirect errors to actionable messages', () => {
    expect(mapGoogleOAuthError('provider is not enabled')).toContain('not enabled in Supabase');
    expect(mapGoogleOAuthError('redirect_uri_mismatch')).toContain('redirect URL is not configured correctly');
    expect(mapGoogleOAuthError('invalid client')).toContain('client configuration is invalid');
  });

  it('falls back to trimmed message or default generic text', () => {
    expect(mapGoogleOAuthError('  custom failure  ')).toBe('custom failure');
    expect(mapGoogleOAuthError('')).toBe('Google sign in failed. Please try again.');
  });

  it('reads params from both query string and hash', () => {
    expect(readOAuthParam('buddybalance://auth/callback?code=abc123', 'code')).toBe('abc123');
    expect(readOAuthParam('buddybalance://auth/callback#access_token=token123', 'access_token')).toBe('token123');
    expect(readOAuthParam('not a url', 'code')).toBeNull();
  });
});
