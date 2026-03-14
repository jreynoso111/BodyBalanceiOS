#!/usr/bin/env bash

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI is required to verify remote secrets."
  exit 1
fi

secrets_output="$(supabase secrets list)"

has_secret() {
  local secret_name="$1"
  grep -Eq "^[[:space:]]*${secret_name}[[:space:]]+\\|" <<<"$secrets_output"
}

print_section() {
  local title="$1"
  echo
  echo "$title"
}

report_missing_group() {
  local group_name="$1"
  shift
  local missing=()

  for secret_name in "$@"; do
    if ! has_secret "$secret_name"; then
      missing+=("$secret_name")
    fi
  done

  if ((${#missing[@]} == 0)); then
    echo "  OK"
    return 0
  fi

  echo "  Missing:"
  printf '  - %s\n' "${missing[@]}"
  return 1
}

report_either_or_group() {
  local label="$1"
  local left="$2"
  local right="$3"

  if has_secret "$left" || has_secret "$right"; then
    echo "  OK: ${left} or ${right}"
    return 0
  fi

  echo "  Missing one of:"
  echo "  - ${left}"
  echo "  - ${right}"
  return 1
}

failures=0

print_section "Public contact"
report_missing_group "public-contact" \
  "PUBLIC_CONTACT_ALLOWED_ORIGINS" \
  "TURNSTILE_SECRET_KEY" \
  "RESEND_API_KEY" \
  "SUPPORT_TO_EMAIL" || failures=$((failures + 1))
report_either_or_group \
  "public-contact-window" \
  "PUBLIC_CONTACT_WINDOW_MINUTES" \
  "PUBLIC_CONTACT_RATE_LIMIT_WINDOW_MS" || failures=$((failures + 1))
report_either_or_group \
  "public-contact-limit" \
  "PUBLIC_CONTACT_MAX_IP_ATTEMPTS" \
  "PUBLIC_CONTACT_RATE_LIMIT_MAX" || failures=$((failures + 1))

print_section "Public auth"
report_missing_group "public-auth" \
  "PUBLIC_AUTH_ALLOWED_ORIGINS" || failures=$((failures + 1))
report_either_or_group \
  "public-auth-redirect" \
  "PUBLIC_AUTH_RESET_REDIRECT_TO" \
  "PUBLIC_AUTH_ALLOWED_RESET_REDIRECTS" || failures=$((failures + 1))
report_either_or_group \
  "public-auth-window" \
  "PUBLIC_AUTH_WINDOW_MINUTES" \
  "PUBLIC_AUTH_RATE_LIMIT_WINDOW_MS" || failures=$((failures + 1))
report_either_or_group \
  "public-auth-limit" \
  "PUBLIC_AUTH_MAX_IP_ATTEMPTS" \
  "PUBLIC_AUTH_RATE_LIMIT_MAX" || failures=$((failures + 1))

print_section "Google Play billing"
report_missing_group "google-play" \
  "GOOGLE_PLAY_ALLOWED_PRODUCT_IDS" \
  "GOOGLE_PLAY_PACKAGE_NAME" \
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL" \
  "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY" || failures=$((failures + 1))

print_section "Summary"
if ((failures == 0)); then
  echo "  All required Supabase secrets are present."
  exit 0
fi

echo "  ${failures} configuration group(s) still incomplete."
exit 1
