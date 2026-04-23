#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required to verify Supabase schema state."
  exit 1
fi

if [[ ! -d supabase/migrations ]]; then
  echo "verify-supabase-schema-state: skipped because supabase/migrations does not exist."
  exit 0
fi

pending_migrations="$(git status --porcelain -- supabase/migrations)"

if [[ -n "$pending_migrations" ]]; then
  echo "verify-supabase-schema-state: pending local changes detected in supabase/migrations."
  echo "Commit or intentionally clear these migration changes before treating the repo as release-ready:"
  echo "$pending_migrations"
  exit 1
fi

echo "verify-supabase-schema-state: supabase/migrations has no local pending changes."
