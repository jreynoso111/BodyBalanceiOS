import { supabase } from '@/services/supabase';

type PublicAuthPayload = {
  ok: boolean;
  action: string;
  email: string;
  redirectTo?: string;
};

async function invokePublicAuth<T extends PublicAuthPayload>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('public-auth', { body });

  if (error) {
    throw new Error(error.message || 'Could not complete the request right now.');
  }

  if (!data?.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Could not complete the request right now.');
  }

  return data as T;
}

export async function requestSignupCode(input: { email: string; fullName: string }) {
  return invokePublicAuth({
    action: 'request_signup_code',
    email: input.email.trim().toLowerCase(),
    fullName: input.fullName.trim(),
  });
}

export async function requestPasswordReset(input: { email: string; redirectTo: string }) {
  return invokePublicAuth({
    action: 'request_password_reset',
    email: input.email.trim().toLowerCase(),
    redirectTo: input.redirectTo.trim(),
  });
}
