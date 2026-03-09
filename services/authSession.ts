import { Session } from '@supabase/supabase-js';

import { supabase } from '@/services/supabase';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForAuthSession(options?: {
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<Session | null> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const intervalMs = options?.intervalMs ?? 200;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      return session;
    }

    await sleep(intervalMs);
  }

  return null;
}
