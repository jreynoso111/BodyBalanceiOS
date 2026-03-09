const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const SUPPORT_TO_EMAIL = Deno.env.get('SUPPORT_TO_EMAIL') || '';
const SUPPORT_FROM_EMAIL = Deno.env.get('SUPPORT_FROM_EMAIL') || 'no-reply@buddybalance.net';
const SUPPORT_FROM_NAME = Deno.env.get('SUPPORT_FROM_NAME') || 'Buddy Balance';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  if (!RESEND_API_KEY || !SUPPORT_TO_EMAIL || !SUPPORT_FROM_EMAIL) {
    return json({ error: 'Missing support email configuration.' }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));

    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const subject = String(body?.subject || '').trim();
    const message = String(body?.message || '').trim();
    const website = String(body?.website || '').trim();
    const source = String(body?.source || req.headers.get('origin') || 'unknown').trim();

    // Honeypot field for low-effort bot submissions.
    if (website) {
      return json({ ok: true });
    }

    if (!name || !email || !message) {
      return json({ error: 'Name, email, and message are required.' }, 400);
    }

    if (!EMAIL_PATTERN.test(email)) {
      return json({ error: 'Invalid email address.' }, 400);
    }

    if (name.length > 120 || subject.length > 160 || message.length > 4000) {
      return json({ error: 'Message is too long.' }, 400);
    }

    const supportSubject = subject || `Website contact from ${name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <h2 style="margin-bottom: 16px;">New Buddy Balance website contact</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Source:</strong> ${escapeHtml(source)}</p>
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
      return json({ error: 'Could not send the support email.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('public-contact failure:', message);
    return json({ error: 'Could not process your message.' }, 500);
  }
});
