import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DEFAULT_RESET_REDIRECT_TO = Deno.env.get('ADMIN_RESET_REDIRECT_TO') || 'buddybalance://reset-password';

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function parseBearerToken(req: Request) {
  const header = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return header.slice(7).trim();
}

async function assertAdmin(authToken: string) {
  if (!authToken) {
    throw new Error('Missing admin access token.');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(authToken);
  if (error || !data.user?.id) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const normalizedRole = String(profile?.role || '').toLowerCase().trim();
  if (normalizedRole !== 'admin' && normalizedRole !== 'administrator') {
    throw new Error('Unauthorized');
  }

  return data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing Supabase function secrets.' }, 500);
  }

  try {
    const adminUserId = await assertAdmin(parseBearerToken(req));
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'send_password_reset') {
      const email = String(body?.email || '').trim().toLowerCase();
      const redirectTo = String(body?.redirectTo || DEFAULT_RESET_REDIRECT_TO).trim() || DEFAULT_RESET_REDIRECT_TO;

      if (!email) {
        return json({ error: 'Missing email.' }, 400);
      }

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        return json({ error: error.message }, 500);
      }

      return json({
        ok: true,
        action,
        email,
        redirectTo,
      });
    }

    if (action === 'delete_user') {
      const userId = String(body?.userId || '').trim();
      if (!userId) {
        return json({ error: 'Missing userId.' }, 400);
      }
      if (userId === adminUserId) {
        return json({ error: 'Admins cannot delete their own account here.' }, 400);
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        return json({ error: error.message }, 500);
      }

      return json({
        ok: true,
        action,
        userId,
      });
    }

    return json({ error: 'Unsupported action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
