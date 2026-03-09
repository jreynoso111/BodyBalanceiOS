# Buddy Balance Release & Security Review

## Executive summary

The code and release blockers identified in the last review have now been corrected in the repo and database, with one remaining external security setting still pending in Supabase Auth.

Current status:

- `npm run typecheck`: passed
- `npm run doctor`: passed
- `npm run export:prod`: passed
- Supabase security advisor: only one remaining warning

## Resolved items

### RES-001 - Admin password reset deep link aligned

- Updated `/Users/jreynoso/I Got You/supabase/functions/admin-user-management/index.ts`
- The fallback reset redirect now uses `buddybalance://reset-password` instead of the obsolete `igotyou://reset-password`.

### RES-002 - Expo notifications plugin added for release builds

- Updated `/Users/jreynoso/I Got You/app.json`
- The app config now includes `expo-notifications`, which reduces native iOS notification drift risk for release builds.

### RES-003 - Biometric lock is now enforced

- Added `/Users/jreynoso/I Got You/components/AppBiometricGate.tsx`
- Added `/Users/jreynoso/I Got You/services/appLock.ts`
- Updated `/Users/jreynoso/I Got You/app/_layout.tsx`
- Updated `/Users/jreynoso/I Got You/app/security.tsx`

The app now:

- reads biometric preference per user
- enforces unlock on app entry for users with biometric lock enabled
- re-locks on foreground return
- allows retry or sign-out from the lock screen

### RES-004 - Database function hardening applied

- Added `/Users/jreynoso/I Got You/supabase/migrations/20260308165702_fix_function_search_paths.sql`
- Applied migration successfully to Supabase

The prior `function_search_path_mutable` warnings for `public.handle_updated_at` and `public.update_loan_status_on_payment` are no longer present in the security advisor.

### RES-005 - Client-side password policy strengthened

- Added `/Users/jreynoso/I Got You/services/passwordPolicy.ts`
- Updated:
  - `/Users/jreynoso/I Got You/app/(auth)/register.tsx`
  - `/Users/jreynoso/I Got You/app/(auth)/reset-password.tsx`
  - `/Users/jreynoso/I Got You/app/security.tsx`

Passwords now require at least 10 characters with uppercase, lowercase, and a number.

## Remaining item

### REM-001 - Supabase leaked-password protection is still disabled

- Source: Supabase security advisor
- Status: not configurable from this repo
- Required action: enable leaked-password protection in Supabase Auth settings
- Reference: [Supabase password security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Recommendation

The codebase is now in substantially better shape for release. I would not treat it as fully ready until `REM-001` is enabled in Supabase Auth and one final physical-device iPhone pass is completed for:

- biometric unlock at cold start
- biometric unlock after background resume
- forgot password
- admin-triggered password reset
- notifications permission and delivery behavior
