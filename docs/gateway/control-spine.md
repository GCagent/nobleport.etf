# NoblePort MCP Control Gateway — The Spine

**Modules:** `backend/gateway/` (auth, policy, approval, audit, spine) ·
API at `/api/gateway` · UI at `/dashboard/gateway`
**Tests:** `backend/tests/test_gateway.py` (17)

> The next move is not adding more "AI names." The next move is turning the
> gateway into the single source of control: **Auth → Policy → Approval → Tool
> Call → Audit → Result.** That is the spine. Everything else hangs off it.

This is that spine, built. Every tool call flows through one fail-closed
pipeline; nothing reaches an execution layer without passing each stage, and
every stage — including every denial — is recorded.

## The six stages

| Stage | Module | Fail-closed rule |
|-------|--------|------------------|
| **Auth** | `auth.py` | Bad / expired / malformed token → rejected. HMAC-SHA256 signature + expiry verified. |
| **Policy** | `policy.py` | Deny-by-default: unallowlisted server/tool, or a missing scope → denied. |
| **Approval** | `approval.py` | Write / money / deploy tools open a human approval ticket; the requester **cannot** approve their own (separation of duties). |
| **Tool Call** | `spine.py` | An allowlisted tool with no bound handler → `NOT_EXECUTABLE`, never a silent pass. |
| **Audit** | `audit.py` | Every stage — allow, deny, approval, error — appended to a sha256 hash-chained ledger. |
| **Result** | `spine.py` | Truth-tagged: `LIVE` only on a real executed call; `STAGED` / `BLOCKED` otherwise. |

## What the uploaded gateway was missing — now built

The Replit gateway zip flagged these gaps; the spine closes the logic for each
(the *infrastructure* remains a production gate):

| Zip gap | Spine status |
|---------|--------------|
| Human approval gate "not implemented" | **Built** — ticketed, separation-of-duties enforced, args-bound |
| Audit "prints to stdout only" | **Built** — hash-chained, tamper-evident (`verify()`) |
| Deny-by-default policy | **Built** — allowlist is the only path |
| Scope enforcement | **Built** — every required scope checked |
| JWT "demo shared-secret" | **Improved** — real HMAC verify + expiry; JWKS is the prod gate |

## Honest production gates (not yet live)

- Real **OIDC/JWKS** verification (today: shared-secret HMAC — real signature
  check, but not IdP key rotation).
- **mTLS** enforcement on outbound MCP calls.
- **Persisted** audit (Postgres/Supabase) + **on-chain anchoring**
  (IPFS/Arweave/Ethereum).
- Live MCP router connectivity verification.

The gateway is registered as **STAGED** in the systems registry with exactly
this next-gate — building the spine does not mint a LIVE claim. The argument-
bound approval is worth noting: an approval ticket is tied to a hash of the
call arguments, so a ticket granted for "create PR: Add X" cannot be replayed
to execute "create PR: Drain treasury" (`test_approval_ticket_bound_to_arguments`).
