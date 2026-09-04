#!/usr/bin/env bash

set -euo pipefail

readonly primary_timeout_seconds="${NPM_AUDIT_TIMEOUT_SECONDS:-180}"
readonly fallback_registry="${NPM_AUDIT_FALLBACK_REGISTRY:-https://registry.yarnpkg.com}"

audit_report="$(mktemp)"
trap 'rm -f "$audit_report"' EXIT

set +e
timeout "${primary_timeout_seconds}s" npm audit "$@" --json >"$audit_report" 2>&1
audit_status=$?
set -e
cat "$audit_report"

if [ "$audit_status" -eq 0 ]; then
  exit 0
fi

# A completed audit report must remain fatal when it contains findings.
if grep -Eq '"vulnerabilities"[[:space:]]*:' "$audit_report"; then
  exit "$audit_status"
fi

# Use the mirror only when npm's advisory service was unavailable or timed out.
if [ "$audit_status" -ne 124 ] &&
   ! grep -Eiq '503|audit endpoint returned an error|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENETUNREACH|ENOTFOUND|network' "$audit_report"; then
  exit "$audit_status"
fi

echo "::warning::npm audit service unavailable; retrying through the Yarn registry mirror"
timeout "${primary_timeout_seconds}s" npm audit "$@" --registry="$fallback_registry"
