import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPPORT_TO_EMAIL = Deno.env.get('SUPPORT_TO_EMAIL') || '';
const SUPPORT_FROM_EMAIL = Deno.env.get('SUPPORT_FROM_EMAIL') || 'no-reply@buddybalance.net';
const SUPPORT_FROM_NAME = Deno.env.get('SUPPORT_FROM_NAME') || 'Buddy Balance';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const DEFAULT_PUBLIC_CONTACT_ALLOWED_ORIGINS = [
  'https://buddybalance.net',
  'https://www.buddybalance.net',
];
const PUBLIC_CONTACT_ALLOWED_ORIGINS = (Deno.env.get('PUBLIC_CONTACT_ALLOWED_ORIGINS') || DEFAULT_PUBLIC_CONTACT_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const TURNSTILE_SECRET_KEY = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
const PUBLIC_CONTACT_WINDOW_MINUTES = Math.max(1, Number(Deno.env.get('PUBLIC_CONTACT_WINDOW_MINUTES') || '10'));
const PUBLIC_CONTACT_MAX_IP_ATTEMPTS = Math.max(1, Number(Deno.env.get('PUBLIC_CONTACT_MAX_IP_ATTEMPTS') || '5'));
const PUBLIC_CONTACT_MAX_EMAIL_ATTEMPTS = Math.max(1, Number(Deno.env.get('PUBLIC_CONTACT_MAX_EMAIL_ATTEMPTS') || '3'));

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const LOCALHOST_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
]);

function getAllowedOrigins() {
  return new Set([...LOCALHOST_ORIGINS, ...PUBLIC_CONTACT_ALLOWED_ORIGINS]);
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeOrigin(origin: string | null) {
  const trimmed = String(origin || '').trim();
  return trimmed || null;
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;
  return getAllowedOrigins().has(origin);
}

function getClientIp(req: Request) {
  const forwardedFor = req.headers.get('x-forwarded-for') || req.headers.get('X-Forwarded-For') || '';
  const forwarded = forwardedFor.split(',')[0]?.trim();
  if (forwarded) return forwarded;

  const cfIp = req.headers.get('cf-connecting-ip') || req.headers.get('CF-Connecting-IP') || '';
  if (cfIp.trim()) return cfIp.trim();

  return '';
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function getBucketStart(now = new Date()) {
  const bucket = new Date(now);
  const minutes = bucket.getUTCMinutes();
  const roundedMinutes = Math.floor(minutes / PUBLIC_CONTACT_WINDOW_MINUTES) * PUBLIC_CONTACT_WINDOW_MINUTES;
  bucket.setUTCMinutes(roundedMinutes, 0, 0);
  return bucket.toISOString();
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

async function enforceRateLimit(clientIp: string, email: string) {
  const ipHash = await sha256(`public-contact:ip:${clientIp}`);
  const emailHash = await sha256(`public-contact:email:${email}`);

  const [ipAttempts, emailAttempts] = await Promise.all([
    bumpRateLimit(`ip:${ipHash}`),
    bumpRateLimit(`email:${emailHash}`),
  ]);

  if (ipAttempts > PUBLIC_CONTACT_MAX_IP_ATTEMPTS) {
    throw new Error('Too many contact attempts from this network. Try again later.');
  }

  if (emailAttempts > PUBLIC_CONTACT_MAX_EMAIL_ATTEMPTS) {
    throw new Error('Too many contact attempts for this email address. Try again later.');
  }
}

async function verifyTurnstile(token: string, clientIp: string) {
  if (!TURNSTILE_SECRET_KEY) return;

  if (!token) {
    throw new Error('CAPTCHA verification is required.');
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      secret: TURNSTILE_SECRET_KEY,
      response: token,
      remoteip: clientIp,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CAPTCHA verification failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data?.success) {
    throw new Error('CAPTCHA verification failed.');
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

  if (!RESEND_API_KEY || !SUPPORT_TO_EMAIL || !SUPPORT_FROM_EMAIL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: 'Missing support email configuration.' }, 500, origin);
  }

  try {
    const body = await req.json().catch(() => ({}));

    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const subject = String(body?.subject || '').trim();
    const message = String(body?.message || '').trim();
    const website = String(body?.website || '').trim();
    const source = String(body?.source || origin || 'unknown').trim();
    const turnstileToken = String(body?.turnstileToken || '').trim();
    const clientIp = getClientIp(req);

    if (!clientIp) {
      return json({ error: 'Client IP unavailable.' }, 400, origin);
    }

    // Honeypot field for low-effort bot submissions.
    if (website) {
      return json({ ok: true }, 200, origin);
    }

    if (!name || !email || !message) {
      return json({ error: 'Name, email, and message are required.' }, 400, origin);
    }

    if (!EMAIL_PATTERN.test(email)) {
      return json({ error: 'Invalid email address.' }, 400, origin);
    }

    if (message.length < 12) {
      return json({ error: 'Message is too short.' }, 400, origin);
    }

    if (name.length > 120 || subject.length > 160 || message.length > 4000) {
      return json({ error: 'Message is too long.' }, 400, origin);
    }

    await verifyTurnstile(turnstileToken, clientIp);
    await enforceRateLimit(clientIp, email);

    const supportSubject = subject || `Website contact from ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin-bottom: 16px;">New Buddy Balance website contact</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Source:</strong> ${escapeHtml(source)}</p>
        <p><strong>Origin:</strong> ${escapeHtml(origin || 'unknown')}</p>
        <p><strong>Subject:</strong> ${escapeHtml(supportSubject)}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;" />
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      </div>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${SUPPORT_FROM_NAME} <${SUPPORT_FROM_EMAIL}>`,
        to: [SUPPORT_TO_EMAIL],
        reply_to: email,
        subject: `[Buddy Balance] ${supportSubject}`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error('Resend send failed:', errorText);
      return json({ error: 'Could not send the support email.' }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('public-contact failure:', message);
    const status = message.toLowerCase().includes('too many') ? 429 : message.toLowerCase().includes('captcha') ? 400 : 500;
    return json({ error: message || 'Could not process your message.' }, status, origin);
  }
});
