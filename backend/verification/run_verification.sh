#!/usr/bin/env bash
#
# NoblePort Verification Runner
# =============================
#
# Runs every offline-runnable verification check, records the result of each as
# an evidence artifact, writes the machine-readable evidence index, and prints
# the honest truth label. This is what turns "we have tests" into "we have
# evidence" — but only for the artifacts that can be proven without a live
# deployment + real vendor credentials. Live-only artifacts (k6 load, Stripe
# sandbox, worker logs) stay PENDING until collected against a real environment.
#
# Usage:
#   backend/verification/run_verification.sh
#
# Outputs:
#   backend/verification/evidence/results/*.log   per-check logs
#   backend/verification/evidence/evidence_index.json
#   stdout: the truth label

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVID="${ROOT}/backend/verification/evidence"
RESULTS="${EVID}/results"
INDEX="${EVID}/evidence_index.json"
PY="${PYTHON:-python3}"

mkdir -p "${RESULTS}"
cd "${ROOT}"

# artifact_key -> "pytest target" (offline-runnable checks only)
declare -A CHECKS=(
  [route_contract]="backend/verification/tests/test_route_contract.py"
  [payment_verification]="backend/verification/tests/test_payment_verification.py"
  [webhook_security]="backend/verification/tests/test_webhook_security.py"
  [migration_roundtrip]="backend/verification/tests/test_migration_rollback.py"
  [object_storage]="backend/verification/tests/test_object_storage.py"
)

# Artifacts that require a live environment — recorded as PENDING, never faked.
declare -A PENDING=(
  [load_report]="k6 run backend/verification/load/k6_tiered.js (vs deployed env)"
  [stripe_sandbox]="Stripe test-mode payment + webhook capture"
  [worker_logs]="APScheduler/Celery execution logs from deployment"
)

echo "== NoblePort verification run =="
declare -A STATUS
declare -A DETAIL

# ---- build / import check ------------------------------------------------
if "${PY}" -c "import backend.main" >"${RESULTS}/build_typecheck.log" 2>&1; then
  STATUS[build_typecheck]="COLLECTED"
  DETAIL[build_typecheck]="backend.main imports cleanly"
  echo "  [PASS] build_typecheck"
else
  STATUS[build_typecheck]="FAILED"
  DETAIL[build_typecheck]="import error (see results/build_typecheck.log)"
  echo "  [FAIL] build_typecheck"
fi

# ---- health endpoint (offline: assert the handler returns status healthy) -
if "${PY}" - >"${RESULTS}/health_endpoint.log" 2>&1 <<'PYEOF'
import asyncio
from backend.api.health import health_check
body = asyncio.run(health_check())
assert body["status"] == "healthy", body
print("health.status ==", body["status"])
PYEOF
then
  STATUS[health_endpoint]="COLLECTED"
  DETAIL[health_endpoint]="health handler returns status=healthy (exact)"
  echo "  [PASS] health_endpoint"
else
  STATUS[health_endpoint]="FAILED"
  DETAIL[health_endpoint]="see results/health_endpoint.log"
  echo "  [FAIL] health_endpoint"
fi

# ---- pytest-driven checks ------------------------------------------------
for key in "${!CHECKS[@]}"; do
  target="${CHECKS[$key]}"
  if "${PY}" -m pytest "${target}" -q -p no:cacheprovider \
        >"${RESULTS}/${key}.log" 2>&1; then
    count="$(grep -oE '[0-9]+ passed' "${RESULTS}/${key}.log" | tail -1)"
    if [[ "${key}" == "object_storage" ]]; then
      STATUS[$key]="NOT_APPLICABLE"
      DETAIL[$key]="no storage backend in build; honesty tripwire green (${count})"
    else
      STATUS[$key]="COLLECTED"
      DETAIL[$key]="${count}"
    fi
    echo "  [PASS] ${key} (${count})"
  else
    STATUS[$key]="FAILED"
    DETAIL[$key]="see results/${key}.log"
    echo "  [FAIL] ${key}"
  fi
done

# ---- write evidence index (JSON) -----------------------------------------
{
  echo '{'
  echo '  "generated_by": "run_verification.sh",'
  echo '  "artifacts": {'
  first=1
  emit() {
    local key="$1" st="$2" dt="$3"
    [[ ${first} -eq 0 ]] && echo ','
    first=0
    printf '    "%s": {"status": "%s", "detail": "%s"}' "${key}" "${st}" "${dt}"
  }
  for key in build_typecheck health_endpoint "${!CHECKS[@]}"; do
    emit "${key}" "${STATUS[$key]}" "${DETAIL[$key]//\"/\'}"
  done
  for key in "${!PENDING[@]}"; do
    emit "${key}" "PENDING" "${PENDING[$key]//\"/\'}"
  done
  echo ''
  echo '  }'
  echo '}'
} > "${INDEX}"

echo
echo "Evidence index written: ${INDEX}"
echo

# ---- truth label ---------------------------------------------------------
"${PY}" -m backend.verification.truth_label
