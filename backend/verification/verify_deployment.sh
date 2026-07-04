#!/usr/bin/env bash
#
# NoblePort Deployment Verification  (audit issues #1, #2, #3, #4)
# ===============================================================
#
# Smoke-checks a *running* NoblePort backend. Unlike the pytest suite (which
# proves behaviour against an in-memory app), this validates a real deployed
# instance reachable over HTTP.
#
# Corrected per the RC1 audit:
#   #1  Health check uses an EXACT match on the parsed JSON field
#       (`jq -r '.status' | grep -x healthy`) — NOT a substring grep that an
#       "unhealthy" body would falsely satisfy.
#   #2  Payment check targets the REAL route (/api/payments/checkout/deposit),
#       never the phantom /api/payments/test.
#   #3  Webhook check asserts the signature gate REJECTS an unsigned payload.
#   #4  Only routes known to be registered are probed.
#
# Usage:
#   BASE_URL=https://api.nobleport.example backend/verification/verify_deployment.sh
#   BASE_URL=http://localhost:8000 backend/verification/verify_deployment.sh
#
# Exit code 0 = all checks passed; non-zero = at least one failed.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
PASS=0
FAIL=0

green() { printf '  \033[32m[PASS]\033[0m %s\n' "$1"; PASS=$((PASS + 1)); }
red()   { printf '  \033[31m[FAIL]\033[0m %s\n' "$1"; FAIL=$((FAIL + 1)); }
info()  { printf '\n== %s ==\n' "$1"; }

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    echo "FATAL: jq is required (exact-match health parsing depends on it)." >&2
    exit 2
  fi
}

# --------------------------------------------------------------------------
require_jq
echo "NoblePort deployment verification against: ${BASE_URL}"

# ---- #1 Health: EXACT status match, not substring ------------------------
info "Health endpoint (exact match)"
HEALTH_BODY="$(curl -fsS --max-time 10 "${BASE_URL}/api/health" 2>/dev/null)"
if [[ -z "${HEALTH_BODY}" ]]; then
  red "GET /api/health returned no body or non-2xx"
else
  # Exact match: a body containing {"status":"unhealthy"} must NOT pass.
  STATUS="$(printf '%s' "${HEALTH_BODY}" | jq -r '.status' 2>/dev/null)"
  if printf '%s' "${STATUS}" | grep -qx "healthy"; then
    green "health.status == \"healthy\" (exact)"
  else
    red "health.status is \"${STATUS}\" (expected exactly \"healthy\")"
  fi
fi

# ---- Feature truth matrix is exposed -------------------------------------
info "Operational truth matrix"
if curl -fsS --max-time 10 "${BASE_URL}/api/health/features" 2>/dev/null \
    | jq -e '.features | length > 0' >/dev/null 2>&1; then
  green "GET /api/health/features exposes the deployment-status matrix"
else
  red "GET /api/health/features missing or empty"
fi

# ---- #4 Route contract: real routes resolve (not 404) --------------------
info "Route contract (advertised routes resolve)"
check_resolves() {
  local method="$1" path="$2"
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
          -X "${method}" "${BASE_URL}${path}" 2>/dev/null)"
  # Anything other than 404/000 means the route is registered (400/401/422 are
  # fine here — we are proving existence, not arguments).
  if [[ "${code}" == "404" || "${code}" == "000" ]]; then
    red "${method} ${path} -> ${code} (route not registered / unreachable)"
  else
    green "${method} ${path} -> ${code} (registered)"
  fi
}
check_resolves GET  /api/payments
check_resolves GET  /api/leads
check_resolves GET  /api/jobs
check_resolves GET  /api/estimates

# ---- #2 Payment: REAL endpoint, not phantom /api/payments/test -----------
info "Payment endpoint (real route)"
PHANTOM_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST "${BASE_URL}/api/payments/test" 2>/dev/null)"
if [[ "${PHANTOM_CODE}" == "404" ]]; then
  green "phantom /api/payments/test is absent (404), as expected"
else
  red "phantom /api/payments/test responded ${PHANTOM_CODE} (should not exist)"
fi
DEPOSIT_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST "${BASE_URL}/api/payments/checkout/deposit?job_id=__verify_probe__" 2>/dev/null)"
# Unknown job -> 400 from the real handler. That proves the route exists and
# enforces its business rule, without creating a real charge.
if [[ "${DEPOSIT_CODE}" == "400" || "${DEPOSIT_CODE}" == "422" ]]; then
  green "POST /api/payments/checkout/deposit enforces job validation (${DEPOSIT_CODE})"
else
  red "POST /api/payments/checkout/deposit returned ${DEPOSIT_CODE} (expected 400/422)"
fi

# ---- #3 Webhook: signature gate rejects an unsigned payload --------------
info "Webhook signature gate"
WH_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
  -X POST "${BASE_URL}/api/payments/webhook/stripe" \
  -H 'stripe-signature: t=1,v1=forged' \
  -H 'content-type: application/json' \
  --data '{"type":"checkout.session.completed"}' 2>/dev/null)"
# With a webhook secret configured the forged signature must be rejected (400).
# If no secret is configured the endpoint will 200 — which this script flags as
# a WARNING because production MUST configure the secret.
if [[ "${WH_CODE}" == "400" ]]; then
  green "forged Stripe signature rejected (400, fail-closed)"
elif [[ "${WH_CODE}" == "200" ]]; then
  red "forged signature ACCEPTED (200) — webhook secret not configured in this env"
else
  red "webhook endpoint returned ${WH_CODE}"
fi

# --------------------------------------------------------------------------
info "Summary"
echo "  passed: ${PASS}   failed: ${FAIL}"
if [[ "${FAIL}" -gt 0 ]]; then
  echo "DEPLOYMENT VERIFICATION: FAILED"
  exit 1
fi
echo "DEPLOYMENT VERIFICATION: PASSED"
exit 0
