# Audit Release & Security Report

Date: 2026-04-18

## Executive Summary

The project is partially ready, but not ready for a clean production upload yet.

What passed:
- Unit tests passed: 11/11 suites, 35/35 tests.
- TypeScript typecheck passed.
- Frontend Supabase usage avoids service-role keys and requires a publishable key.
- Public auth and public contact flows include rate limiting and origin controls.

What blocks release today:
- The iOS membership flow is not App Store ready: the code explicitly says iOS billing is still pending while Premium access is shared across app and web.
- The web deploy configuration is broken because `vercel.json` calls `npm run build:web`, but that script does not exist in `package.json`.
- The receipt evidence flow is incomplete: uploads target a `receipts` bucket that is never created in migrations, and the receipt viewer button does not actually open the uploaded file.
- `expo-doctor` still reports dependency health issues (`react-native-worklets` version mismatch and `expo-iap` flagged as unmaintained).

## Findings

### 1. High: iOS Premium flow is not App Store-ready

- Location:
  - `services/billing.ts:287-294`
  - `app/subscription.tsx:203-210`
  - `app/subscription.tsx:283-348`
- Evidence:
  - The iOS billing message says: `iOS billing is still pending App Store setup.`
  - The membership screen says Premium is purchased through Google Play and that Premium status is shared across the app and web account center.
- Impact:
  - If Premium unlocks digital functionality on iOS, this is a likely App Store review blocker until the iOS purchase/compliance story is completed or the iOS feature set is constrained appropriately.
- Recommendation:
  - Either implement StoreKit-compliant iOS purchase handling, or remove/limit iOS access to paid digital entitlements until the App Store flow is policy-safe.

### 2. High: Web deployment is currently broken

- Location:
  - `vercel.json:2`
  - `package.json:5-23`
- Evidence:
  - `vercel.json` defines `buildCommand` as `npm run build:web`.
  - `package.json` does not define a `build:web` script.
  - Reproduction: `npm run build:web` fails with `Missing script: "build:web"`.
- Impact:
  - Any Vercel deployment using the committed config will fail before build output is produced.
- Recommendation:
  - Add a real `build:web` script or remove/correct `vercel.json` if web deploy is not part of this repository.

### 3. High: Receipt attachment flow is not production-complete

- Location:
  - `app/new-loan.tsx:228-237`
  - `app/loan/[id].tsx:964-969`
  - `supabase/rls_policies.sql:246-281`
- Evidence:
  - New loans upload evidence to `supabase.storage.from('receipts')`.
  - The SQL file defines policies for bucket `receipts` but does not create that bucket.
  - The attachment button calls `getPublicUrl(...)` and then only shows an alert; it never opens the file.
- Impact:
  - Fresh environments can fail to upload evidence if the bucket was never created manually.
  - Even when uploads succeed, users cannot reliably open attached receipts from the detail screen.
- Recommendation:
  - Add a migration that creates the `receipts` bucket explicitly.
  - Decide whether the bucket is private or public and use the matching retrieval method.
  - Wire the button to actually open a signed URL or downloaded file.

### 4. Medium: Expo dependency health is not fully release-clean

- Location:
  - `package.json:35-70`
- Evidence:
  - `npx expo-doctor` reported:
    - `react-native-worklets` expected `0.7.2`, found `0.7.4`
    - `expo-iap` flagged as unmaintained by React Native Directory metadata
- Impact:
  - Patch mismatches can introduce native/runtime instability in release builds.
  - The billing dependency merits extra caution for future maintenance and SDK compatibility.
- Recommendation:
  - Align `react-native-worklets` with Expo SDK expectations.
  - Re-evaluate the long-term billing package choice or document why the current dependency remains acceptable.

### 5. Low: Web security hardening is not visible in repo config

- Location:
  - `app/+html.tsx:10-31`
  - `vercel.json:1-4`
- Evidence:
  - The web HTML defines metadata and inline styles, but no CSP or other browser security headers are visible here.
  - `vercel.json` does not define any response headers.
- Impact:
  - This leaves the web surface without visible defense-in-depth controls against script injection or framing unless they are added elsewhere in infrastructure.
- Recommendation:
  - Add CSP, `X-Content-Type-Options`, `Referrer-Policy`, and clickjacking protection at the hosting layer if the web build is intended for production.

## Verification Performed

- `npm test -- --runInBand` -> passed
- `./node_modules/typescript/bin/tsc --noEmit --pretty false` -> passed
- `npx expo-doctor` -> 15/17 checks passed, 2 failed
- `npm run build:web` -> failed because the script is missing

## Store Policy Notes

- Google Play policy requires Play Billing for digital subscriptions and in-app digital functionality. The current Android billing direction is aligned with that requirement, assuming the billing flow works end-to-end in production.
- Apple App Review guidelines require complete, functional binaries and require in-app purchase for unlocking digital features in iOS apps unless a specific exception applies. If Premium access is intended to be sold or unlocked on iOS, that flow still needs explicit App Store compliance review before submission.

## Final Verdict

Not ready for a clean production upload yet.

Minimum path to green:
1. Resolve the iOS Premium/App Store compliance story.
2. Fix the broken web build path or remove the invalid deploy config.
3. Finish and verify the receipt attachment flow.
4. Clear the Expo Doctor findings.
5. Run one real-device release smoke pass for billing, auth recovery, notifications, and support.
