import { supabase } from '@/services/supabase';

export interface UserPreferences {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  reminder_enabled: boolean;
  biometric_enabled: boolean;
  marketing_enabled: boolean;
  preferred_currencies: string[];
  updated_at?: string;
}

export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'user_id'> = {
  push_enabled: false,
  email_enabled: true,
  reminder_enabled: false,
  biometric_enabled: false,
  marketing_enabled: false,
  preferred_currencies: ['USD'],
};

export function sanitizePreferredCurrencies(currencies?: string[] | null): string[] {
  const normalized = (currencies || [])
    .map((code) => String(code || '').trim().toUpperCase())
    .filter(Boolean);

  const deduped = Array.from(new Set(normalized));
  if (deduped.length === 0) return ['USD'];
  return deduped;
}

export async function getOrCreateUserPreferences(userId: string): Promise<{
  data: UserPreferences | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  if (data) {
    return {
      data: {
        ...(data as UserPreferences),
        preferred_currencies: sanitizePreferredCurrencies((data as any).preferred_currencies),
      },
      error: null,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from('user_preferences')
    .insert([{ user_id: userId, ...DEFAULT_USER_PREFERENCES }])
    .select('*')
    .single();

  if (insertError) {
    return { data: null, error: new Error(insertError.message) };
  }

  return { data: inserted as UserPreferences, error: null };
}

export async function updateUserPreferences(
  userId: string,
  patch: Partial<Omit<UserPreferences, 'user_id' | 'updated_at'>>
): Promise<{ data: UserPreferences | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select('*')
    .single();

  if (error) {
    return { data: null, error: new Error(error.message) };
  }

  return {
    data: {
      ...(data as UserPreferences),
      preferred_currencies: sanitizePreferredCurrencies((data as any)?.preferred_currencies),
    },
    error: null,
  };
}
