#!/usr/bin/env bash
# Stephanie.ai core platform verification matrix.
# Runs every check it can in the current environment and reports real
# results; steps whose tooling is unavailable are marked SKIPPED, and any
# FAILED step makes the script exit non-zero.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
declare -a RESULTS=()
FAILURES=0

record() { # name status
  RESULTS+=("$1|$2")
  [ "$2" = "FAILED" ] && FAILURES=$((FAILURES + 1)) || true
}

echo "=========================================================================="
echo "    STEPHANIE.AI CORE PLATFORM VERIFICATION AND COMPILATION MATRIX"
echo "=========================================================================="

echo "[1/5] nobleport-core: install, compile, and test crypto/hash-chain layers"
if (cd "$ROOT/packages/nobleport-core" \
    && npm install --no-audit --no-fund \
    && npm run build \
    && npm test); then
  record "nobleport-core build + tests" "PASSED"
else
  record "nobleport-core build + tests" "FAILED"
fi

echo "[2/5] truth-ledger: prisma schema validation"
if (cd "$ROOT/packages/truth-ledger" && npm install --no-audit --no-fund \
    && npm run validate); then
  record "truth-ledger prisma validate" "PASSED"
else
  record "truth-ledger prisma validate" "FAILED"
fi

echo "[3/5] stephanie-avatar + hitl-console: TypeScript boundary checks"
AVATAR_OK=1
for app in stephanie-avatar hitl-console; do
  if ! (cd "$ROOT/apps/$app" && npm install --no-audit --no-fund \
      && npm run typecheck); then
    AVATAR_OK=0
  fi
done
if [ "$AVATAR_OK" = 1 ]; then
  record "front-end typechecks" "PASSED"
else
  record "front-end typechecks" "FAILED"
fi

echo "[4/5] stephanie-orchestrator: pytest suite"
if command -v pytest >/dev/null 2>&1 || python3 -c "import pytest" 2>/dev/null; then
  if (cd "$ROOT/apps/stephanie-orchestrator" && python3 -m pytest -q); then
    record "orchestrator pytest" "PASSED"
  else
    record "orchestrator pytest" "FAILED"
  fi
else
  echo "pytest not installed; run: pip install -r apps/stephanie-orchestrator/requirements.txt"
  record "orchestrator pytest" "SKIPPED"
fi

echo "[5/5] Summary"
echo "--------------------------------------------------------------------------"
for row in "${RESULTS[@]}"; do
  printf '  %-40s %s\n' "${row%%|*}" "${row##*|}"
done
echo "--------------------------------------------------------------------------"
if [ "$FAILURES" -gt 0 ]; then
  echo "RESULT: $FAILURES check(s) FAILED"
  exit 1
fi
echo "RESULT: all executed checks passed"
