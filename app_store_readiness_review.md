# App Store Readiness Review

## Executive Summary

The app is not ready for App Store submission yet. The biggest blockers are unfinished in-app purchase integration, manual Premium entitlement paths that weaken monetization control, and an unauthenticated support email function that can be abused. There is also at least one export-related client-side security issue and SDK package drift that should be corrected before release builds.

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

### 3. Public contact function is an unauthenticated email relay with no rate limiting
- File:
  - `supabase/functions/public-contact/index.ts`
- Impact: attackers can automate spam and abuse your outbound email reputation, potentially causing support email delivery failures or provider suspension.
- Evidence:
  - Wildcard CORS is enabled.
  - The endpoint is public.
  - There is no CAPTCHA, origin allowlist, rate limiting, or abuse throttling.
  - A honeypot field alone is not enough for production abuse resistance.

### 4. CSV export is vulnerable to formula injection
- File:
  - `services/exportService.ts`
- Impact: if a contact name or description starts with spreadsheet formula characters such as `=`, `+`, `-`, or `@`, opening the exported CSV in Excel/Sheets can execute attacker-controlled formulas.
- Evidence:
  - Export rows interpolate user-controlled `contacts.name` and `loan.description` directly into CSV output without formula neutralization.

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
3. Add abuse controls to the public support email function.
4. Sanitize CSV exports against formula injection.
5. Align Expo dependency versions with the installed SDK.
6. Add at least smoke-test coverage for auth, billing, referrals, and profile/security flows.
