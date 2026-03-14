# Security Setup (Supabase + Client)

## 1) Frontend credentials policy

- The app must use only:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Never place service-role keys in the app bundle.
- `services/supabase.ts` enforces this by rejecting keys that are not `sb_publishable_*`.

## 2) Environment variables

1. Copy `.env.example` to `.env`.
2. Fill in your project values.
3. Keep `.env` out of git (already ignored in `.gitignore`).

To verify remote Supabase secrets before a release, run:

- `npm run verify:supabase-config`

For the public contact relay, also configure:

- `PUBLIC_CONTACT_ALLOWED_ORIGINS`
- `TURNSTILE_SECRET_KEY`
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY`
- `PUBLIC_CONTACT_WINDOW_MINUTES`
- `PUBLIC_CONTACT_MAX_IP_ATTEMPTS`
- `PUBLIC_CONTACT_MAX_EMAIL_ATTEMPTS`

Legacy Supabase secrets are also accepted for compatibility:

- `PUBLIC_CONTACT_RATE_LIMIT_WINDOW_MS`
- `PUBLIC_CONTACT_RATE_LIMIT_MAX`

Default allowed origins in the function include `https://buddybalance.net`, `https://www.buddybalance.net`, and local development hosts. Override them if your production web domain differs.

For public registration and password recovery, also configure:

- `PUBLIC_AUTH_ALLOWED_ORIGINS`
- `PUBLIC_AUTH_RESET_REDIRECT_TO`
- `PUBLIC_AUTH_WINDOW_MINUTES`
- `PUBLIC_AUTH_MAX_IP_ATTEMPTS`
- `PUBLIC_AUTH_MAX_EMAIL_ATTEMPTS`

Legacy Supabase secrets are also accepted for compatibility:

- `PUBLIC_AUTH_ALLOWED_RESET_REDIRECTS`
- `PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS`
- `PUBLIC_AUTH_RATE_LIMIT_MAX`

The `public-auth` function now fronts `register` and `forgot-password` so the mobile app is no longer sending those requests straight to Supabase Auth without rate limiting. Reset links are sanitized to the Buddy Balance reset route before they are sent.

For Android billing validation, configure these Supabase secrets:

- `GOOGLE_PLAY_ALLOWED_PRODUCT_IDS`
- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`

## 3) Session storage

- On mobile, auth session tokens are stored in `expo-secure-store` (encrypted at rest).
- On web, browser storage is used by Supabase client.

## 4) RLS (Row Level Security)

Run the SQL in:

- `supabase/rls_policies.sql`

This enables RLS policies for:

- `contacts`
- `loans`
- `payments`
- `p2p_requests`
- `payment_history`
- `profiles`
- `storage.objects` (`receipts` bucket)

It also creates:

- `public.find_profile_match(p_email, p_phone)` as a controlled lookup function used by the app.

## 5) Post-setup verification checklist

- Verify all app tables have RLS enabled in Supabase dashboard.
- Verify there are no permissive `anon` policies left.
- Verify auth works with `EXPO_PUBLIC_SUPABASE_ANON_KEY` only.
- Verify `new-contact` linking works through `find_profile_match` RPC.
