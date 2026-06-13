#!/usr/bin/env bash
# NoblePort Systems — run the entire REAL command surface.
#
# Executes every measurable check the repo actually has, in one pass:
# governance regression, attestation registry validation, operational truth
# summary, quantum threat posture, OS module counts, the backend test suite,
# and (with --full) the TypeScript/Next build and RPC connection probe.
# Every number printed is computed; nothing is asserted.
#
# Usage: bash scripts/nobleport-run-all.sh [--full]

set -uo pipefail
cd "$(dirname "$0")/.."
FULL=${1:-}
FAILURES=0

section() { printf '\n━━━ %s ━━━\n' "$1"; }

section "1/7 Backend test suite (governance + attestation registry)"
python -m pytest backend/tests/ -q || FAILURES=$((FAILURES+1))

section "2/7 Governance compliance regression (measured, not narrative)"
python - <<'EOF' || FAILURES=$((FAILURES+1))
import json
from backend.governance import run_baseline
_, m = run_baseline()
r = m.as_report()
print(json.dumps({"totals": r["totals"], "rates": r["rates"], "integrity": r["integrity"]}, indent=1))
EOF

section "3/7 Attestation registry validation + summary"
python - <<'EOF' || FAILURES=$((FAILURES+1))
import json
from backend.governance import validate_registry, registry_summary
v = validate_registry()
print("invariant violations:", v if v else "none")
print(json.dumps(registry_summary(), indent=1))
EOF

section "4/7 Operational Truth Matrix"
python - <<'EOF' || FAILURES=$((FAILURES+1))
from backend.config.operational_truth import get_status_summary, get_live_features
print("status counts:", get_status_summary())
print("LIVE features:", ", ".join(get_live_features()))
EOF

section "5/7 Cyborg.ai quantum threat posture"
python - <<'EOF' || FAILURES=$((FAILURES+1))
import sys, json; sys.path.insert(0, "cyborg/nvapi")
from app.quantum import get_threat_summary
print(json.dumps(get_threat_summary(), indent=1))
EOF

section "6/7 Stephanie.ai skill registry"
python - <<'EOF' || FAILURES=$((FAILURES+1))
import yaml
d = yaml.safe_load(open("backend/governance/stephanie_skill_registry.yaml"))
tags = {}
for s in d["skills"]:
    tags[s["truth_tag"]] = tags.get(s["truth_tag"], 0) + 1
print("skills:", len(d["skills"]), "by tag:", tags)
print("excluded narrative claims tracked:", len(d["excluded_claims"]))
print("can_claim_credentials:", d["credential_policy"]["can_claim_credentials"])
EOF

section "7/7 NoblePort OS module registry"
node - <<'EOF' || FAILURES=$((FAILURES+1))
const ts = require('fs').readFileSync('src/lib/nobleport-os/apps.ts', 'utf8');
const counts = { live: 0, staged: 0, planned: 0 };
for (const m of ts.matchAll(/status: '(live|staged|planned)'/g)) counts[m[1]]++;
console.log('modules:', counts.live + counts.staged + counts.planned, counts);
EOF

if [ "$FULL" = "--full" ]; then
  section "FULL: TypeScript + Next.js build"
  npx tsc --noEmit && npm run build >/dev/null 2>&1 && echo "build: PASS" || { echo "build: FAIL"; FAILURES=$((FAILURES+1)); }
  section "FULL: RPC connection probe (wallet lab)"
  node scripts/wallet-lab/check-connections.mjs || true
fi

section "RESULT"
if [ "$FAILURES" -eq 0 ]; then echo "ALL REAL COMMANDS PASSED"; else echo "FAILURES: $FAILURES"; exit 1; fi
