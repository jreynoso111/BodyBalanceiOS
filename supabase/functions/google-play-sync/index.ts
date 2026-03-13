import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.9.6';

import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const GOOGLE_PLAY_PACKAGE_NAME = Deno.env.get('GOOGLE_PLAY_PACKAGE_NAME') || '';
const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL') || '';
const GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = (Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY') || '').replace(/\\n/g, '\n');
const GOOGLE_PLAY_ALLOWED_PRODUCT_IDS = (Deno.env.get('GOOGLE_PLAY_ALLOWED_PRODUCT_IDS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

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

async function getGoogleAccessToken() {
  const privateKey = await importPKCS8(GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/androidpublisher',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL)
    .setSubject(GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google OAuth token exchange failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('Google OAuth token exchange did not return access_token.');
  }

  return String(data.access_token);
}

async function fetchProductPurchase({
  packageName,
  productId,
  purchaseToken,
}: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}) {
  const accessToken = await getGoogleAccessToken();
  const url =
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}` +
    `/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Play purchase lookup failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

function resolvePlanTierFromGooglePurchase(purchase: any) {
  // Check the raw numeric state first (Google Play ProductPurchase returns integer 0 for purchased).
  if (purchase?.purchaseState === 0) {
    return 'premium';
  }

  const purchaseState = String(
    purchase?.purchaseStateContext?.purchaseState ||
      purchase?.purchaseState ||
      purchase?.purchaseStatus ||
      ''
  )
    .toUpperCase()
    .trim();

  // Also support textual states if they appear
  if (purchaseState === 'PURCHASED' || purchaseState === 'PURCHASE_STATE_PURCHASED' || purchaseState === '0') {
    return 'premium';
  }

  return 'free';
}

async function updateProfilePlan(appUserId: string, planTier: 'free' | 'premium') {
  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from('profiles')
    .select('plan_tier')
    .eq('id', appUserId)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(existingProfileError.message);
  }

  const previousPlanTier = String(existingProfile?.plan_tier || 'free').toLowerCase().trim();
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      plan_tier: planTier,
      last_premium_granted_at:
        planTier === 'premium' && previousPlanTier !== 'premium' ? new Date().toISOString() : undefined,
      last_premium_granted_source:
        planTier === 'premium' && previousPlanTier !== 'premium' ? 'purchase' : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appUserId);

  if (error) {
    throw new Error(error.message);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing Supabase function secrets.' }, 500);
  }

  if (!GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return json({ error: 'Missing Google Play service account secrets.' }, 503);
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
    const packageName = String(body?.package_name || GOOGLE_PLAY_PACKAGE_NAME).trim();
    const productId = String(body?.product_id || '').trim();
    const purchaseToken = String(body?.purchase_token || '').trim();
    const isSubscription = Boolean(body?.is_subscription);

    if (isSubscription) {
      return json({ error: 'This function currently validates one-time Google Play products only.' }, 400);
    }

    if (!packageName) {
      return json({ error: 'Missing package_name' }, 400);
    }

    if (GOOGLE_PLAY_PACKAGE_NAME && packageName !== GOOGLE_PLAY_PACKAGE_NAME) {
      return json({ error: 'package_name does not match configured Google Play package.' }, 400);
    }

    if (!productId) {
      return json({ error: 'Missing product_id' }, 400);
    }

    if (GOOGLE_PLAY_ALLOWED_PRODUCT_IDS.length > 0 && !GOOGLE_PLAY_ALLOWED_PRODUCT_IDS.includes(productId)) {
      return json({ error: 'product_id is not allowed for Premium activation.' }, 400);
    }

    if (!purchaseToken) {
      return json({ error: 'Missing purchase_token' }, 400);
    }

    const purchase = await fetchProductPurchase({
      packageName,
      productId,
      purchaseToken,
    });
    const planTier = resolvePlanTierFromGooglePurchase(purchase);

    await updateProfilePlan(authData.user.id, planTier);

    return json({
      ok: true,
      appUserId: authData.user.id,
      planTier,
      purchaseState: purchase?.purchaseStateContext?.purchaseState || null,
      acknowledgementState: purchase?.acknowledgementState || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
