import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DEFAULT_PUBLIC_AUTH_ALLOWED_ORIGINS = [
  'https://buddybalance.net',
  'https://www.buddybalance.net',
];
const PUBLIC_AUTH_ALLOWED_ORIGINS = (Deno.env.get('PUBLIC_AUTH_ALLOWED_ORIGINS') || DEFAULT_PUBLIC_AUTH_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const LEGACY_PUBLIC_AUTH_ALLOWED_RESET_REDIRECTS = (Deno.env.get('PUBLIC_AUTH_ALLOWED_RESET_REDIRECTS') || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const DEFAULT_RESET_REDIRECT_TO =
  Deno.env.get('PUBLIC_AUTH_RESET_REDIRECT_TO') ||
  LEGACY_PUBLIC_AUTH_ALLOWED_RESET_REDIRECTS[0] ||
  'buddybalance://reset-password';
const PUBLIC_AUTH_WINDOW_MS = resolveWindowMs({
  minutesEnvName: 'PUBLIC_AUTH_WINDOW_MINUTES',
  legacyMsEnvName: 'PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS',
  defaultMinutes: 15,
});
const PUBLIC_AUTH_MAX_IP_ATTEMPTS = resolveAttemptLimit({
  envName: 'PUBLIC_AUTH_MAX_IP_ATTEMPTS',
  legacyEnvName: 'PUBLIC_AUTH_RATE_LIMIT_MAX',
  defaultValue: 8,
});
const PUBLIC_AUTH_MAX_EMAIL_ATTEMPTS = resolveAttemptLimit({
  envName: 'PUBLIC_AUTH_MAX_EMAIL_ATTEMPTS',
  legacyEnvName: 'PUBLIC_AUTH_RATE_LIMIT_MAX',
  defaultValue: 3,
});

const LOCALHOST_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function getPositiveNumberFromEnv(envName: string) {
  const value = Number(Deno.env.get(envName) || '');
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveWindowMs({
  minutesEnvName,
  legacyMsEnvName,
  defaultMinutes,
}: {
  minutesEnvName: string;
  legacyMsEnvName: string;
  defaultMinutes: number;
}) {
  const explicitMinutes = getPositiveNumberFromEnv(minutesEnvName);
  if (explicitMinutes) {
    return explicitMinutes * 60_000;
  }

  const legacyWindowMs = getPositiveNumberFromEnv(legacyMsEnvName);
  if (legacyWindowMs) {
    return Math.max(60_000, legacyWindowMs);
  }

  return defaultMinutes * 60_000;
}

function resolveAttemptLimit({
  envName,
  legacyEnvName,
  defaultValue,
}: {
  envName: string;
  legacyEnvName: string;
  defaultValue: number;
}) {
  const explicitValue = getPositiveNumberFromEnv(envName);
  if (explicitValue) {
    return Math.max(1, Math.floor(explicitValue));
  }

  const legacyValue = getPositiveNumberFromEnv(legacyEnvName);
  if (legacyValue) {
    return Math.max(1, Math.floor(legacyValue));
  }

  return defaultValue;
}

function getAllowedOrigins() {
  return new Set([...LOCALHOST_ORIGINS, ...PUBLIC_AUTH_ALLOWED_ORIGINS]);
}

function buildCorsHeaders(origin: string | null) {
  const allowedOrigins = getAllowedOrigins();
  const allowOrigin = origin && allowedOrigins.has(origin) ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function json(body: Record<string, unknown>, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

function normalizeOrigin(origin: string | null) {
  const trimmed = String(origin || '').trim();
  return trimmed || null;
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  return getAllowedOrigins().has(origin);
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('X-Forwarded-For') || '';
  const forwarded = forwardedFor.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  const cfIp = req.headers.get('cf-connecting-ip') || req.headers.get('CF-Connecting-IP') || '';
  if (cfIp.trim()) return cfIp.trim();

  return 'unknown';
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getBucketStart(now = new Date()) {
  const bucketMs = Math.floor(now.getTime() / PUBLIC_AUTH_WINDOW_MS) * PUBLIC_AUTH_WINDOW_MS;
  return new Date(bucketMs).toISOString();
}

async function bumpRateLimit(rateKey: string) {
  const { data, error } = await supabaseAdmin.rpc('bump_public_contact_rate_limit', {
    p_rate_key: rateKey,
    p_bucket_start: getBucketStart(),
  });

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  return Number(data || 0);
}

async function enforceRateLimit(action: string, clientIp: string, email: string) {
  const ipHash = await sha256(`public-auth:${action}:ip:${clientIp}`);
  const emailHash = await sha256(`public-auth:${action}:email:${email}`);

  const [ipAttempts, emailAttempts] = await Promise.all([
    bumpRateLimit(`public-auth:${action}:ip:${ipHash}`),
    bumpRateLimit(`public-auth:${action}:email:${emailHash}`),
  ]);

  if (ipAttempts > PUBLIC_AUTH_MAX_IP_ATTEMPTS) {
    throw new Error('Too many attempts from this network. Try again later.');
  }

  if (emailAttempts > PUBLIC_AUTH_MAX_EMAIL_ATTEMPTS) {
    throw new Error('Too many attempts for this email address. Try again later.');
  }
}

function isResetPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, '');
  return normalizedPath.endsWith('/reset-password') || normalizedPath.endsWith('/--/reset-password');
}

function sanitizeResetRedirect(rawValue: string) {
  const candidate = rawValue.trim() || DEFAULT_RESET_REDIRECT_TO;

  if (LEGACY_PUBLIC_AUTH_ALLOWED_RESET_REDIRECTS.includes(candidate)) {
    return candidate;
  }

  try {
    const parsed = new URL(candidate);
    const origin = `${parsed.protocol}//${parsed.host}`;

    if (parsed.protocol === 'buddybalance:' && (parsed.host === 'reset-password' || isResetPath(parsed.pathname))) {
      return candidate;
    }

    if ((parsed.protocol === 'exp:' || parsed.protocol === 'exps:') && isResetPath(parsed.pathname)) {
      return candidate;
    }

    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && isAllowedOrigin(origin) && isResetPath(parsed.pathname)) {
      return candidate;
    }
  } catch {
    // Fall through to default redirect.
  }

  return DEFAULT_RESET_REDIRECT_TO;
}

function validateName(name: string) {
  if (!name.trim()) {
    throw new Error('Please enter your full name.');
  }

  if (name.trim().length > 120) {
    throw new Error('Full name is too long.');
  }
}

function validateEmail(email: string) {
  if (!email) {
    throw new Error('Please enter your email address.');
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
}

Deno.serve(async (req) => {
  const origin = normalizeOrigin(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(origin) });
  }

  if (!isAllowedOrigin(origin)) {
    return json({ error: 'Origin not allowed.' }, 403, origin);
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, origin);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing public auth configuration.' }, 500, origin);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const clientIp = getClientIp(req);

    validateEmail(email);
    await enforceRateLimit(action || 'unknown', clientIp, email);

    if (action === 'request_signup_code') {
      const fullName = String(body?.fullName || '').trim();
      validateName(fullName);

      const { error } = await supabaseAdmin.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        const normalizedMessage = error.message.toLowerCase();
        if (normalizedMessage.includes('already registered')) {
          return json({ ok: true, action, email }, 200, origin);
        }

        return json({ error: error.message }, 400, origin);
      }

      return json({ ok: true, action, email }, 200, origin);
    }

    if (action === 'request_password_reset') {
      const redirectTo = sanitizeResetRedirect(String(body?.redirectTo || ''));
      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        return json({ error: error.message }, 400, origin);
      }

      return json({ ok: true, action, email, redirectTo }, 200, origin);
    }

    return json({ error: 'Unsupported action.' }, 400, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('public-auth failure:', message);
    const lower = message.toLowerCase();
    const status = lower.includes('too many') ? 429 : lower.includes('valid') || lower.includes('full name') || lower.includes('unsupported') ? 400 : 500;
    return json({ error: message || 'Could not process the request.' }, status, origin);
  }
});
