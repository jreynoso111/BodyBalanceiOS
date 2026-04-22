const DEFAULT_PRIVATE_ALLOWED_ORIGINS = [
  'https://buddybalance.net',
  'https://www.buddybalance.net',
];

const PRIVATE_FUNCTION_ALLOWED_ORIGINS = (Deno.env.get('PRIVATE_FUNCTION_ALLOWED_ORIGINS') || DEFAULT_PRIVATE_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const LOCALHOST_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
]);

export function normalizeOrigin(origin: string | null) {
  const trimmed = String(origin || '').trim();
  return trimmed || null;
}

export function getAllowedPrivateOrigins() {
  return new Set([...LOCALHOST_ORIGINS, ...PRIVATE_FUNCTION_ALLOWED_ORIGINS]);
}

export function isAllowedPrivateOrigin(origin: string | null) {
  if (!origin) return true;
  return getAllowedPrivateOrigins().has(origin);
}

export function buildPrivateCorsHeaders(origin: string | null) {
  const allowOrigin = origin && isAllowedPrivateOrigin(origin) ? origin : 'null';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}
