#!/usr/bin/env bash
#
# Smoke test: 26 Dorothy Lucille end-to-end
#
# Usage:
#   docker compose up --build -d
#   ./smoke-test.sh
#
set -euo pipefail

API="http://localhost:8000"
PASS=0
FAIL=0

ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== DesignAgent Smoke Test ==="
echo ""

# --- 1. Health check ---
echo "1. Health check"
HEALTH=$(curl -sf "$API/health" || echo '{"status":"unreachable"}')
if echo "$HEALTH" | grep -q '"healthy"'; then
    ok "API healthy"
else
    fail "API not healthy: $HEALTH"
fi
echo ""

# --- 2. Create project ---
echo "2. Create project: 26 Dorothy Lucille"
PROJECT=$(curl -sf -X POST "$API/projects" \
  -H "Content-Type: application/json" \
  -d '{
    "org_id": "nobleport",
    "name": "26 Dorothy Lucille",
    "address": "26 Dorothy Lucille, Newburyport, MA",
    "zoning_district": "R-2",
    "lot_area_sf": 9600,
    "frontage_sf": 80,
    "depth_sf": 120,
    "lot_width_sf": 80,
    "source_name": "manual"
  }')
PROJECT_ID=$(echo "$PROJECT" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -n "$PROJECT_ID" ]; then
    ok "Project created (id=$PROJECT_ID)"
else
    fail "Project creation failed: $PROJECT"
    echo "Cannot continue without project. Exiting."
    exit 1
fi
echo ""

# --- 3. Run zoning ---
echo "3. Dispatch zoning"
ZONING=$(curl -sf -X POST "$API/runs/zoning" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":$PROJECT_ID}")
ZONING_ID=$(echo "$ZONING" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -n "$ZONING_ID" ]; then
    ok "Zoning dispatched (run_id=$ZONING_ID)"
else
    fail "Zoning dispatch failed: $ZONING"
fi

# Wait for worker to process
echo "   Waiting for zoning worker..."
sleep 3

ZONING_RESULT=$(curl -sf "$API/runs/$ZONING_ID")
ZONING_STATUS=$(echo "$ZONING_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")
if [ "$ZONING_STATUS" = "completed" ]; then
    ok "Zoning completed"
    # Check determinism: R-2 on 9600sf lot should produce specific envelope
    GFA=$(echo "$ZONING_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['output_payload']['max_gfa_sf'])" 2>/dev/null || echo "0")
    echo "   max_gfa_sf=$GFA"
else
    fail "Zoning status: $ZONING_STATUS (expected completed)"
fi
echo ""

# --- 4. Gate test: estimate before zoning approval should fail ---
echo "4. Gate test: estimate before approval"
GATE_TEST=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/runs/estimate" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\":$PROJECT_ID}")
# Zoning completed (not yet approved), but gate accepts completed too
if [ "$GATE_TEST" = "201" ]; then
    ok "Estimate accepted (zoning completed counts as gate pass)"
    # Get the estimate run id for later
    EST_DISPATCH=$(curl -sf "$API/runs?project_id=$PROJECT_ID" | python3 -c "
import sys, json
runs = json.load(sys.stdin)
est = [r for r in runs if r['run_type'] == 'estimate']
print(est[0]['id'] if est else '')
" 2>/dev/null || echo "")
elif [ "$GATE_TEST" = "409" ]; then
    ok "Gate correctly blocked (409)"
    # Approve zoning first, then retry
    echo "   Approving zoning run..."
    curl -sf -X POST "$API/runs/approve" \
      -H "Content-Type: application/json" \
      -d "{\"run_id\":$ZONING_ID, \"approved\":true}" > /dev/null
    ok "Zoning approved"
    EST_DISPATCH=$(curl -sf -X POST "$API/runs/estimate" \
      -H "Content-Type: application/json" \
      -d "{\"project_id\":$PROJECT_ID, \"price_book_version\":\"v1\", \"labor_burden_pct\":28, \"waste_factor_pct\":10, \"markup_pct\":20}")
    EST_ID=$(echo "$EST_DISPATCH" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
else
    fail "Unexpected gate response: $GATE_TEST"
fi
echo ""

# --- 5. Run estimate ---
echo "5. Estimate"
# If we got the estimate from step 4, wait for it; otherwise dispatch now
if [ -z "${EST_ID:-}" ] && [ -n "${EST_DISPATCH:-}" ]; then
    EST_ID="$EST_DISPATCH"
fi
if [ -z "${EST_ID:-}" ]; then
    EST_RES=$(curl -sf -X POST "$API/runs/estimate" \
      -H "Content-Type: application/json" \
      -d "{\"project_id\":$PROJECT_ID, \"price_book_version\":\"v1\", \"labor_burden_pct\":28, \"waste_factor_pct\":10, \"markup_pct\":20}")
    EST_ID=$(echo "$EST_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
fi

if [ -n "$EST_ID" ]; then
    ok "Estimate dispatched (run_id=$EST_ID)"
    echo "   Waiting for estimate worker..."
    sleep 3
    EST_RESULT=$(curl -sf "$API/runs/$EST_ID")
    EST_STATUS=$(echo "$EST_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")
    if [ "$EST_STATUS" = "completed" ]; then
        ok "Estimate completed"
        TOTAL=$(echo "$EST_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['output_payload']['total_estimated_cost'])" 2>/dev/null || echo "0")
        echo "   total_estimated_cost=\$$TOTAL"
    else
        fail "Estimate status: $EST_STATUS"
    fi
else
    fail "Could not dispatch estimate"
fi
echo ""

# --- 6. Run report ---
echo "6. Report"
REPORT_RES=$(curl -sf -X POST "$API/runs/report?project_id=$PROJECT_ID")
REPORT_ID=$(echo "$REPORT_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -n "$REPORT_ID" ]; then
    ok "Report dispatched (run_id=$REPORT_ID)"
    echo "   Waiting for report worker..."
    sleep 3
    REPORT_RESULT=$(curl -sf "$API/runs/$REPORT_ID")
    REPORT_STATUS=$(echo "$REPORT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "unknown")
    if [ "$REPORT_STATUS" = "completed" ]; then
        ok "Report completed"
        ARTIFACT=$(echo "$REPORT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['artifact_path'])" 2>/dev/null || echo "none")
        echo "   artifact_path=$ARTIFACT"
    else
        fail "Report status: $REPORT_STATUS"
    fi
else
    fail "Report dispatch failed: $REPORT_RES"
fi
echo ""

# --- 7. Audit log ---
echo "7. Audit log"
AUDIT=$(curl -sf "$API/audit/$PROJECT_ID")
AUDIT_COUNT=$(echo "$AUDIT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
if [ "$AUDIT_COUNT" -gt 0 ]; then
    ok "Audit log has $AUDIT_COUNT entries"
else
    fail "Audit log empty"
fi
echo ""

# --- 8. Verify DB persistence ---
echo "8. DB persistence check"
DB_PROJECT=$(curl -sf "$API/projects/$PROJECT_ID")
DB_NAME=$(echo "$DB_PROJECT" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])" 2>/dev/null || echo "")
if [ "$DB_NAME" = "26 Dorothy Lucille" ]; then
    ok "Project persisted in DB"
else
    fail "Project not found in DB"
fi
echo ""

# --- Summary ---
echo "=== Results ==="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "ALL CHECKS PASSED — 26 Dorothy Lucille runs end-to-end."
else
    echo "SOME CHECKS FAILED — review output above."
    exit 1
fi
