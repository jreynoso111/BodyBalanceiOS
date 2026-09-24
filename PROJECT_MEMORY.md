# Buddy Balance project memory

## App and local workflow

- Buddy Balance is an Expo SDK 55 / React Native TypeScript app using Expo Router. Supabase provides authentication and app data. `app.config.js` merges `app.json` and reads environment values; never put credentials in either file.
- Start the local web version with `npx expo start --web --port 4174`. Check the rendered route in a browser; a successful export or HTTP response alone does not confirm the account flow works.
- Web account routes share `components/website/WebAccountLayout.tsx`. `constants/i18n.ts` contains exact-string translations consumed by `components/Themed.tsx`; add translations for user-visible strings when adding or correcting Spanish, French, or Italian UI.
- Preserve unrelated working-tree edits and generated release files. Do not reset or broadly stage the repository.

## CodeGraph

- This repository has a local `.codegraph/` index and uses the `codegraph` CLI. See `AGENTS.md` for the required query workflow.
- `.codegraph/` is generated and ignored. The CLI is installed on the current workstation; a new workstation may need its own install and index.

## TypeSafe

- The TypeSafe agent skill is installed at `~/.codex/skills/typesafe-ai`; it is a workstation skill, not an app dependency.
- Direct System One API use requires a server-side API key. Keep that key outside source control. Do not send loan balances, payment history, account records, or other personal financial data to TypeSafe. Any initial product experiment should use anonymized support issue text, human review, and a configured key only after the user sets up access.

## Google Play release gates

- Android application ID: `com.jreynoso.buddybalance`. `app.json` holds the app configuration; `app.config.js` enforces that at least one Android Premium product ID is set for a production build.
- As of 2026-09-24, Google Play required new apps and app updates to target API 36 from 2026-08-31. `app.json` now configures `expo-build-properties` with Android compile SDK 36 and target SDK 36. Recheck the current Play requirement and confirm the built AAB manifest before each submission; config intent alone does not prove what a signed bundle contains.
- A local signed AAB is not evidence of a Play upload, review, or production release. Check the actual Play Console track and release status before reporting publication. A new upload must use a version code greater than the latest version accepted by Play; the local config has used version code 30.
- Verify Premium product IDs against the products configured in Play Console. A local config validator previously found a template-like product ID; EAS production variables and Play Console product state were not inspected. Never print or commit secret values.
- Confirm the Play Console account's current testing and account-deletion declarations. If the developer account is personal and was created after 2023-11-13, Play's closed-test requirement may apply; verify the current rule and account type. Apps with account creation need a working in-app deletion path and external deletion resource, plus matching Play Console declarations.
- Before a release build, recheck dependency alignment, native Android configuration, billing on a real Android build, privacy/data-safety declarations, store assets, and the actual internal/closed test. A successful TypeScript check is not a release sign-off.

## Supabase boundary

- For Supabase work, read the current Supabase skill and changelog before implementing. Inspect actual schema/RLS and the serving environment before changing behavior. Do not apply remote DDL, change production data, or use an open dashboard for unrelated projects during an app audit.
- This repository has `public.keepalive_ping()` in `supabase/migrations/20260909001035_keepalive_rpc.sql`. It is a stable, no-table-read RPC that returns `{ok, checked_at}`; execution is granted only to `anon` and `authenticated`.
- An external GitHub Actions workflow at `.github/workflows/supabase-keepalive.yml` calls that RPC with `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` repository secrets. It runs at 05:17, 13:17, and 21:17 UTC daily. Keep the scheduler external: Supabase Cron uses `pg_cron` inside the database being protected; an Edge Function is only a handler unless an external scheduler invokes it.
- Supabase documents automatic pausing of Free projects after low activity across seven days and says a few database requests daily typically suffice. The scheduled call is read-only; do not replace the publishable key with `service_role` or query user tables for keepalive.
- On 2026-09-21, one scheduled GitHub run failed because the runner could not resolve the Supabase hostname. A manual run on 2026-09-24 succeeded before and after the schedule adjustment. Check recent GitHub Actions runs if the user reports a pause or connection issue.
- The user explicitly authorized this keepalive schedule; that authorization covers only the minimal RPC and its external schedule, not other remote schema or data changes.
