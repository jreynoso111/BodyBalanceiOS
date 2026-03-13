# Release Smoke Checklist

Use this checklist before promoting a build to production or store review.

## Authentication

- Register with email/password.
- Sign out and sign back in.
- Trigger forgot-password from web and mobile.
- Complete reset-password and confirm login with the new password.
- If Google OAuth is enabled for the build, complete Google sign-in on a real device.

## Premium / Billing

- On Android, open Membership and confirm billing status reaches "Google Play billing is ready".
- Complete a Google Play Premium purchase with a test account.
- Confirm `profiles.plan_tier` becomes `premium`.
- Restore the Google Play purchase on a fresh install or signed-in session.
- Confirm iOS does not present a misleading live-billing path.

## Referrals

- Apply a valid invitation code on a new account.
- Confirm invite summary updates for inviter and invitee.
- Reach the reward threshold and confirm Premium referral messaging and expiry display.

## Notifications

- Grant notification permission on a real device.
- Confirm Expo push token is stored for the profile.
- Trigger at least one shared update notification.
- Trigger one reminder notification for a money record and one for an item record.

## Support / Public Contact

- Submit the public contact form from an allowed origin.
- Confirm CAPTCHA renders and blocks submission when incomplete.
- Confirm rate limiting returns an error after repeated submissions.
- Confirm support email arrives at the configured inbox.

## Export

- Export CSV with normal data and open it in Excel/Sheets.
- Export CSV with formula-like contact/description values and confirm cells are neutralized.
- Generate and share a PDF record export on-device.

## Build / Release Gate

- Run `npm run verify:release`.
- Run one production-like Android build.
- If shipping iOS, run one physical-device iPhone pass for auth recovery, notifications, and support flows.
