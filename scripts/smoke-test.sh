#!/usr/bin/env bash
# Stephanie.ai Launch Gate Smoke Test
# Run: ./scripts/smoke-test.sh [BASE_URL]
set -euo pipefail

BASE="${1:-http://localhost:8000}"
PASS=0
FAIL=0

check() {
  local name="$1" url="$2" expected="$3"
  local body status
  body=$(curl -sf "$url" 2>/dev/null) && status=0 || status=1

  if [ $status -ne 0 ]; then
    echo "  FAIL  $name (connection refused)"
    FAIL=$((FAIL+1))
    return
  fi

  if echo "$body" | grep -q "$expected"; then
    echo "  PASS  $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $name (expected '$expected')"
    echo "        got: $body"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "═══════════════════════════════════════════"
echo " Stephanie.ai Launch Gate Smoke Test"
echo " Target: $BASE"
echo "═══════════════════════════════════════════"
echo ""

echo "[Infrastructure]"
check "Health endpoint"     "$BASE/health"         '"ok":true'
check "Ready endpoint"      "$BASE/ready"          '"ready":true'
check "Launch gates"        "$BASE/metrics/gates"  '"database":"PASS"'

echo ""
echo "[Session Flow]"
# Start session
SESSION=$(curl -sf -X POST "$BASE/api/session" -H 'Content-Type: application/json' 2>/dev/null || echo '{}')
SID=$(echo "$SESSION" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$SID" ]; then
  echo "  PASS  Session start (id=$SID)"
  PASS=$((PASS+1))

  # Send message
  RESP=$(curl -sf -X POST "$BASE/api/message" \
    -H 'Content-Type: application/json' \
    -d "{\"session_id\":\"$SID\",\"text\":\"hello\"}" 2>/dev/null || echo '{}')

  if echo "$RESP" | grep -q '"response"'; then
    echo "  PASS  Message returns response"
    PASS=$((PASS+1))
  else
    echo "  FAIL  Message response missing"
    FAIL=$((FAIL+1))
  fi

  # End session
  END=$(curl -sf -X DELETE "$BASE/api/session/$SID" 2>/dev/null || echo '{}')
  if echo "$END" | grep -q '"ended"'; then
    echo "  PASS  Session end"
    PASS=$((PASS+1))
  else
    echo "  FAIL  Session end"
    FAIL=$((FAIL+1))
  fi
else
  echo "  FAIL  Session start (no session_id)"
  FAIL=$((FAIL+3))
fi

echo ""
echo "[Audit]"
check "Audit writes (via health)" "$BASE/ready" '"audit_chain":true'

echo ""
echo "═══════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo " RESULT: ALL PASS ($PASS checks)"
  echo " STATUS: LAUNCH READY"
else
  echo " RESULT: $FAIL FAILED / $PASS PASSED"
  echo " STATUS: NOT LAUNCH READY"
fi
echo "═══════════════════════════════════════════"
echo ""

exit $FAIL
