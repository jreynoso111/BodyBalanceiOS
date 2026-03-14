import { supabase } from '@/services/supabase';

export async function deleteMyAccount(confirmation: string) {
  const normalizedConfirmation = confirmation.trim().toUpperCase();
  if (normalizedConfirmation !== 'DELETE') {
    throw new Error('Type DELETE to confirm account deletion.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Your session is no longer available. Sign in again and retry.');
  }

  const { data, error } = await supabase.functions.invoke('account-management', {
    body: {
      action: 'delete_my_account',
      confirmation: normalizedConfirmation,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(error.message || 'Could not delete your account right now.');
  }

  if (!data?.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'Could not delete your account right now.');
  }

  return data;
}
