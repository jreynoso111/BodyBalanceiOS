import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

async function removeBucketFolder(bucket: string, userId: string, extraPaths: string[] = []) {
  const targets = new Set<string>(extraPaths.filter(Boolean));
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(userId, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });

  if (!error && Array.isArray(data)) {
    for (const item of data) {
      if (item?.name) {
        targets.add(`${userId}/${item.name}`);
      }
    }
  }

  if (targets.size === 0) {
    return;
  }

  const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove([...targets]);
  if (removeError) {
    console.warn(`storage cleanup failed for ${bucket}:`, removeError.message);
  }
}

async function detachExternalReferences(userId: string) {
  const now = new Date().toISOString();

  const operations = [
    supabaseAdmin
      .from('contacts')
      .update({
        target_user_id: null,
        link_status: 'private',
      })
      .eq('target_user_id', userId),
    supabaseAdmin
      .from('loans')
      .update({
        target_user_id: null,
        validation_status: 'none',
        updated_at: now,
      })
      .eq('target_user_id', userId),
    supabaseAdmin
      .from('payments')
      .update({
        target_user_id: null,
        validation_status: 'none',
      })
      .eq('target_user_id', userId),
    supabaseAdmin
      .from('payment_history')
      .update({
        changed_by: null,
      })
      .eq('changed_by', userId),
    supabaseAdmin
      .from('p2p_requests')
      .delete()
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`),
  ];

  const results = await Promise.all(operations);
  for (const result of results) {
    if (result.error) {
      throw new Error(result.error.message);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing Supabase function secrets.' }, 500);
  }

  try {
    const token = parseBearerToken(req);
    if (!token) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user?.id) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const confirmation = String(body?.confirmation || '').trim().toUpperCase();
    const userId = authData.user.id;

    if (action !== 'delete_my_account') {
      return json({ error: 'Unsupported action.' }, 400);
    }

    if (confirmation !== 'DELETE') {
      return json({ error: 'Type DELETE to confirm account deletion.' }, 400);
    }

    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle();

    await detachExternalReferences(userId);
    await Promise.all([
      removeBucketFolder('avatars', userId, [String(profileData?.avatar_url || '')]),
      removeBucketFolder('receipts', userId),
    ]);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ error: deleteError.message }, 500);
    }

    return json({
      ok: true,
      action,
      userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
