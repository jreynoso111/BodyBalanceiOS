# Security Best Practices Report

## Executive Summary

The project is in decent shape on the basics: frontend Supabase credentials are constrained to publishable keys, `.env` is ignored, RLS policy scaffolding exists, and `npm audit --omit=dev` returned zero known production dependency vulnerabilities at the time of review.

I found two security issues worth addressing before calling the app fully hardened:

1. `revenuecat-sync` can become an unauthenticated profile-plan mutation endpoint if the webhook auth token is not configured.
2. The biometric lock gate can briefly fail open while it is still resolving remote lock state, which weakens the privacy guarantee of the app lock.

## High Severity

### SEC-1: `revenuecat-sync` accepts unauthenticated webhook-style writes when `REVENUECAT_WEBHOOK_AUTH_TOKEN` is unset

**Impact:** An unauthenticated caller can trigger plan-tier synchronization for arbitrary `app_user_id` values, causing unauthorized profile state changes and untrusted RevenueCat lookups.

**Code references**

- [`/Users/jreynoso/I Got You iOS/supabase/functions/revenuecat-sync/index.ts:137`](/Users/jreynoso/I%20Got%20You%20iOS/supabase/functions/revenuecat-sync/index.ts#L137)
- [`/Users/jreynoso/I Got You iOS/supabase/functions/revenuecat-sync/index.ts:146`](/Users/jreynoso/I%20Got%20You%20iOS/supabase/functions/revenuecat-sync/index.ts#L146)
- [`/Users/jreynoso/I Got You iOS/supabase/functions/revenuecat-sync/index.ts:150`](/Users/jreynoso/I%20Got%20You%20iOS/supabase/functions/revenuecat-sync/index.ts#L150)
- [`/Users/jreynoso/I Got You iOS/supabase/functions/revenuecat-sync/index.ts:161`](/Users/jreynoso/I%20Got%20You%20iOS/supabase/functions/revenuecat-sync/index.ts#L161)

**Why it matters**

The function intentionally supports two modes:

- authenticated client calls using a Supabase bearer token
- RevenueCat webhook calls using a shared secret token

The problem is that the webhook branch only enforces auth **if** `REVENUECAT_WEBHOOK_AUTH_TOKEN` is present. If that secret is missing, requests without a bearer token fall into the webhook path and can submit any `app_user_id`, after which the function writes `plan_tier` back to `profiles`.

That creates a configuration-sensitive fail-open path around a write-capable endpoint.

**Recommended fix**

- Fail closed: require `REVENUECAT_WEBHOOK_AUTH_TOKEN` for webhook mode.
- If the token is missing, reject webhook-style requests with `503` or `401` instead of accepting them.
- Consider separating webhook and client sync into different endpoints to reduce ambiguity.

## Moderate Severity

### SEC-2: Biometric gate can render protected screens before lock state resolves

**Impact:** On app startup or route changes, protected content can appear before the biometric requirement is enforced, weakening local privacy controls.

**Code references**

- [`/Users/jreynoso/I Got You iOS/components/AppBiometricGate.tsx:35`](/Users/jreynoso/I%20Got%20You%20iOS/components/AppBiometricGate.tsx#L35)
- [`/Users/jreynoso/I Got You iOS/components/AppBiometricGate.tsx:66`](/Users/jreynoso/I%20Got%20You%20iOS/components/AppBiometricGate.tsx#L66)
- [`/Users/jreynoso/I Got You iOS/components/AppBiometricGate.tsx:69`](/Users/jreynoso/I%20Got%20You%20iOS/components/AppBiometricGate.tsx#L69)
- [`/Users/jreynoso/I Got You iOS/components/AppBiometricGate.tsx:197`](/Users/jreynoso/I%20Got%20You%20iOS/components/AppBiometricGate.tsx#L197)
- [`/Users/jreynoso/I Got You iOS/services/appLock.ts:7`](/Users/jreynoso/I%20Got%20You%20iOS/services/appLock.ts#L7)

**Why it matters**

`AppBiometricGate` initializes with:

- `loading = false`
- `requiresUnlock = false`

and returns `null` whenever both remain false. The lock state is then resolved asynchronously from cached storage and from user preferences. During that gap, the app can render normally before the overlay appears.

The cached flag is also stored in `AsyncStorage`, which is convenience storage rather than security-oriented storage. Even if the remote preference later corrects the value, the initial decision path is still fail-open.

**Recommended fix**

- Default the gate to blocking for authenticated users until lock state is resolved.
- Treat unresolved state as locked, not unlocked.
- Store the cached biometric-enabled flag in `SecureStore` instead of `AsyncStorage`, or stop trusting cached state for access-control decisions.

## Low Severity / Hardening

### SEC-3: Shared function CORS policy is fully wildcarded

**Code references**

- [`/Users/jreynoso/I Got You iOS/supabase/functions/_shared/cors.ts:1`](/Users/jreynoso/I%20Got%20You%20iOS/supabase/functions/_shared/cors.ts#L1)

**Notes**

This is not an immediate exploit by itself because the protected functions still validate bearer tokens server-side. Still, `Access-Control-Allow-Origin: *` is broader than necessary for sensitive account/admin functions and increases exposure if a token is obtained elsewhere.

**Recommended fix**

- Split public CORS from authenticated/admin CORS.
- Restrict authenticated/admin functions to the known web origins actually used by the product.

## What Checked Clean

- `npm audit --omit=dev` returned zero known production dependency vulnerabilities.
- `.env` is ignored by git and not tracked.
- Frontend Supabase initialization rejects non-publishable keys in [`/Users/jreynoso/I Got You iOS/services/supabase.ts:16`](/Users/jreynoso/I%20Got%20You%20iOS/services/supabase.ts#L16).
- Public auth and public contact endpoints implement origin checks and rate limiting.

## Recommended Release Decision

Do not treat the app as "fully hardened" until SEC-1 and SEC-2 are fixed. If you are comfortable with a managed risk release, SEC-1 is the first item to fix before production, and SEC-2 should follow immediately after.
