# Stephanie.ai Execution Framework (Phases 1–6)

Monorepo implementation of the Stephanie.ai architecture roadmap: a shared
verification core, a canonical truth-ledger schema, a LangGraph supervisor
with HITL gating, the voice/avatar pipeline client, and the human approval
console.

```
[ apps/stephanie-avatar ] ◄──(voice stream)──► [ apps/stephanie-orchestrator ]
          │                                              │
          ▼                                              ▼
[ packages/nobleport-core ] ◄──(schema & hash)──► [ packages/truth-ledger ]
          │                                              │
          └──────────► PostgreSQL + pgvector ◄───────────┘
```

## Layout

| Path | Phase | Contents |
| --- | --- | --- |
| `packages/nobleport-core` | 1 | `TruthTier` / `AgentCapability` enums, `AUTHORITY_MATRIX`, canonical JSON, SHA-256 + Ed25519 `CryptographicCore`, hash-chain `appendEntry` / `verifyChain` |
| `packages/truth-ledger` | 2 | Prisma schema (jobs, permits, agent sessions, truth ledger, HITL approvals) + pgvector `memory_embeddings` migration |
| `apps/stephanie-orchestrator` | 3–4 | Pydantic transit models (camelCase-aliased), LangGraph supervisor with HITL routing, WebSocket voice ingress |
| `apps/stephanie-avatar` | 4 | `VoiceSessionManager` (16 kHz PCM streaming) + `MIL_SPEC_LATENCY_CONTRACT` |
| `apps/hitl-console` | 5 | `ConsoleDashboard` L3/L4 gate intervention panel |
| `scripts/verify-pipeline-integrity.sh` | 6 | Builds, typechecks, validates, and tests everything above |

## Verification

```bash
./scripts/verify-pipeline-integrity.sh
```

Runs: nobleport-core build + 13 node tests, `prisma validate`, front-end
typechecks, and the orchestrator's 11 pytest cases (including a compiled
LangGraph end-to-end run of both the HITL-gated and direct-execution paths).
Every step reports PASSED / FAILED / SKIPPED honestly and any failure exits
non-zero.

## Deliberate upgrades from the blueprint

1. **Canonical hashing** — `JSON.stringify(payload, Object.keys(payload).sort())`
   treats the key array as a whitelist at *every* depth, silently dropping
   nested keys from the hash input. Replaced with recursive key-sorted
   canonicalization (`src/crypto/canonical.ts`); the Python side hashes
   `json.dumps(..., sort_keys=True, separators=(",", ":"))` to match.
2. **Ed25519 API** — `@noble/curves` v1 is synchronous
   (`ed25519.sign/verify`); the async wrapper methods are kept for API
   stability. `verifySignature` returns `false` on malformed input instead of
   throwing.
3. **Polymorphic ledger** — `truth_ledger.entity_id` spans jobs, permits, and
   sessions, so the required FK to `jobs` was removed (it would reject every
   non-job row). Chain integrity is cryptographic (`previous_hash` /
   `current_hash` unique / `signature`), verified by `verifyChain`.
4. **Testable supervisor** — node functions and routing are pure; the graph
   compiles lazily in `build_graph()` so the authority logic is importable
   and testable even where langgraph isn't installed. Capability→HITL mapping
   comes from the shared `AUTHORITY_MATRIX` instead of being re-hardcoded.
5. **HITL console** — API base and reviewer credential are props (staging and
   production differ by environment, not code); decisions handle HTTP
   failures and lock the panel after a recorded decision.
6. **Honest verification script** — root-relative paths, per-step
   PASSED/FAILED/SKIPPED results, non-zero exit on failure; no
   unconditionally printed "all systems pass" line.

## Integration path with the existing backend

- `backend/api/dashboard.py` and `src/lib/dashboard/mock.ts` still serve
  deterministic fixtures. As each panel is cut over to live joins, tag the
  data with its real `TruthTier` — fixtures are at most `T1_PARSED_STRUCTURED`
  and must not present as production truth.
- `backend/agents/stephanie.py` (intake/orchestration) is the consumer of the
  supervisor graph; L3/L4 branches must block on a `hitl_approvals` row before
  execution.
- Voice: `apps/stephanie-avatar` streams PCM to
  `apps/stephanie-orchestrator/voice/stream_handler.py`; transcripts feed the
  supervisor, so voice answers inherit the same tier discipline.
