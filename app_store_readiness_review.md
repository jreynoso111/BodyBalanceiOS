# App Store Readiness Review

## Executive Summary

The app is not ready for App Store submission yet. The biggest blockers are unfinished in-app purchase integration and manual Premium entitlement paths that weaken monetization control. Earlier findings around the public support endpoint and CSV export handling have been addressed in the current code, but should remain on the release verification checklist. Expo SDK package drift should also be corrected before release builds.

## Critical

### 1. Premium billing is not implemented for iOS or Android
- Files:
  - `services/billing.ts`
  - `app/subscription.tsx`
- Impact: the paid offering is not operational, so the app is not launch-ready or monetization-ready.
- Evidence:
  - `isBillingAvailable()` only returns `true` on Android.
  - iOS explicitly reports billing is paused.
  - `purchasePremiumPackage()` throws a “not configured yet” error.
  - The subscription screen tells users that direct store billing is not live yet.

### 2. Premium access can still be granted manually outside store purchase validation
- Files:
  - `app/subscription.tsx`
  - `supabase/migrations/20260307160000_secure_plan_tier_updates.sql`
- Impact: paid entitlement control is not anchored to verified purchase state, which weakens monetization integrity and creates App Store policy risk if digital access is granted outside approved flows.
- Evidence:
  - The subscription screen states that admins can switch users between Free and Premium from the admin dashboard.
  - `admin_set_profile_plan_tier(...)` directly updates `profiles.plan_tier`.

## High

### 3. Public contact function hardening
- File:
  - `supabase/functions/public-contact/index.ts`
- Status: addressed in the current implementation.
- Current protections:
  - Per-origin CORS handling with an allowlist instead of wildcard access.
  - Cloudflare Turnstile verification for non-local traffic.
  - IP and email-based rate limiting via `bump_public_contact_rate_limit`.
  - Honeypot field plus input length and format validation.
- Residual release check:
  - Confirm the production secrets and rate-limit RPC are deployed and working.

### 4. CSV export formula injection
- File:
  - `services/exportService.ts`
- Status: addressed in the current implementation.
- Current protections:
  - `services/csv.ts` neutralizes formula-like prefixes before escaping CSV cells.
  - `services/exportService.ts` uses `escapeCsvCell(...)` for exported user-controlled fields.
- Residual release check:
  - Keep regression tests for formula-like values and manually verify one export in Excel/Sheets during release QA.

## Medium

### 5. Expo SDK package drift may cause release instability or submission-time surprises
- File:
  - `package.json`
- Impact: mismatched Expo package versions increase the chance of native/runtime regressions during archive generation or store QA.
- Evidence:
  - `expo-doctor` reports mismatches for `expo-dev-client`, `expo-image-picker`, `expo-notifications`, and `expo-router`.

## Release Gaps

### 6. Test coverage and release verification are not evident
- Evidence:
  - The project exposes `typecheck` and `doctor`, but no unit, integration, or E2E test scripts are defined in `package.json`.
- Risk:
  - Core flows such as auth recovery, Premium entitlement transitions, referrals, notifications, and export flows appear to rely on manual verification.

## Recommended Launch Order

1. Finish real App Store / Play billing integration and remove placeholder messaging.
2. Lock Premium entitlement changes behind verified purchase or tightly scoped support tooling.
3. Align Expo dependency versions with the installed SDK.
4. Re-verify public contact abuse protections in production.
5. Re-verify CSV export neutralization in release QA.
6. Add at least smoke-test coverage for auth, billing, referrals, and profile/security flows.
