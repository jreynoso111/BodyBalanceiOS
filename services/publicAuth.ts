import { supabase } from '@/services/supabase';

type PublicAuthPayload = {
  ok: boolean;
  action: string;
  email: string;
  redirectTo?: string;
};

async function readFunctionErrorMessage(error: any) {
  const fallbackMessage = error?.message || 'Could not complete the request right now.';
  const response = error?.context;

  if (!response || typeof response !== 'object' || typeof response.text !== 'function') {
    return fallbackMessage;
  }

  try {
    const rawText = await response.text();
    if (!rawText) {
      return fallbackMessage;
    }

    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // Fall back to raw text when the response is not JSON.
    }

    return rawText;
  } catch {
    return fallbackMessage;
  }
}

async function invokePublicAuth<T extends PublicAuthPayload>(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('public-auth', { body });

  if (error) {
    throw new Error(await readFunctionErrorMessage(error));
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
