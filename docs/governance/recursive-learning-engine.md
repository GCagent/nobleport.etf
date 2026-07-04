# Stephanie.ai Recursive Learning Engine — Built Out, Auditable

**Source spec:** Stephanie.ai Recursive Learning Integration Plan v2.0
(NoblePort Systems). **Status:** STAGED / Human-Approved Execution.
**Final decision authority:** Michael F. O'Rourke.

This converts the Recursive Learning Integration Plan from a concept into an
executable, auditable subsystem of NoblePort OS. It upgrades Stephanie.ai from a
RAG assistant that *retrieves* into a **recursive executive operator** that
learns patterns, critiques assumptions, identifies risk, synthesizes
cross-domain knowledge, and improves its next recommendation — without
manufacturing authority, certainty, or unreviewed credentials.

The defining constraint, taken straight from the plan: improve decision quality
**without creating governance, compliance, or hallucination risk.** Every design
choice below serves that constraint.

---

## What was built

| Plan section | Code | What it does |
|--------------|------|--------------|
| Layer 2 — Recursive Learning Engine | `backend/learning/engine.py` | Walks a question through the 8-stage workflow, runs the loops, scores depth/confidence, assigns a Truth-Layer tag, stores a memory |
| Learning Loop Types (1–5) | `backend/learning/loops.py` | First Principles, Counterargument, Edge Case, Cross-Domain Transfer, Executive Simulation — each a driving question + structured prompts |
| Certification Alignment Engine | `backend/learning/knowledge_domains.py` | Maps a topic onto knowledge domains (Construction, Real Estate, Finance, Governance); names the licensed reviewer; `can_claim_credential` is always `False` |
| Recursive Memory Structure | `backend/learning/memory.py` | The plan's memory JSON (topic, depth_score, confidence, sources, counterarguments, connections, next_review) + a SHA-256 hash chain |
| Dashboard — Command Center | `backend/learning/metrics.py` | Learning depth vs. target (8.0), connections created, knowledge gaps, confidence — all measured from stored memories |
| NoblePort Priority Topics + First Pilot | `backend/learning/topics.py` | The 5 priority topics and the recommended first pilot (90-Day Growth Plan) |
| LangGraph node → mesh agent | `backend/agents/recursive_learning.py` | `RecursiveLearningAgent` wired into the AgentMesh and event router |
| Persistence | `backend/models/learning_memory.py` | `LearningMemory` table mirroring the memory shape for production |
| API | `backend/api/learning.py` | `/api/learning/{learn,priority-topic/{key},first-pilot,command-center,memory,loops,knowledge-domains,priority-topics}` |
| Tests | `backend/tests/test_recursive_learning.py` | 14 tests asserting the honesty guarantees below |

> **Note on LangGraph.** The integration plan describes the engine as a new
> LangGraph node. NoblePort OS does not run LangGraph — it runs its own async
> `BaseAgent` mesh (Stephanie, GCagent, PermitStream, Cyborg, AuditBeacon). The
> engine is implemented as a sixth mesh agent so it shares the same task router,
> health telemetry, audit recording, and governance posture as the rest of the
> OS. The workflow stages and loops match the plan exactly.

---

## The workflow

```
Question → Retrieve → Challenge → Counterargument → Stress Test
        → Synthesis → Certification Mapping → Memory Storage
```

All eight stages run on every cycle (`test_cycle_runs_all_workflow_stages`).

## The five learning loops

| Loop | Driving question | Lens |
|------|------------------|------|
| First Principles | What must be true? | Decompose to the conditions a recommendation depends on |
| Counterargument | Why might this fail? | Argue the opposite case; surface fragility |
| Edge Case Discovery | What breaks under stress? | Apply a shock; trace second-order effects |
| Cross-Domain Transfer | What does another industry know? | Borrow proven mechanisms from adjacent fields |
| Executive Simulation | What would a CEO do? | Weigh risk, capital, ops, legal exposure, reputation |

---

## The hard guarantees (enforced, not described)

1. **A learning cycle is analysis, never an executed action.** Outputs can never
   be `LIVE`. A cycle touching a regulated/credentialed domain is `STAGED` (held
   for licensed human review); otherwise it is `SIMULATED`.
   (`test_regulated_topic_is_staged_not_live`, `test_non_regulated_topic_is_simulated`)
2. **No claimed credentials.** The certification step maps onto knowledge domains
   and names the licensed reviewer; `can_claim_credential` is always `False`.
   (`test_knowledge_domains_never_claim_credentials`)
3. **Confidence never claims certainty.** It is computed from evidence and
   clamped to `[0.05, 0.95]`; more sources raise it, knowledge gaps lower it.
   (`test_confidence_never_reaches_certainty`, `test_confidence_rises_with_evidence`)
4. **Honest uncertainty.** Zero sources, thin evidence, or a topic that maps to
   no known domain are surfaced as explicit knowledge gaps, not hidden.
   (`test_no_sources_flags_a_knowledge_gap`, `test_unmapped_topic_flags_out_of_scope`)
5. **Tamper-evident memory.** Every stored memory is SHA-256 hash-chained to the
   previous one; altering any field breaks chain verification.
   (`test_memory_chain_is_tamper_evident`)
6. **Lower confidence earns sooner review.** `next_review` is 7/14/30 days for
   low/medium/high confidence. (`test_next_review_scheduled_sooner_for_low_confidence`)
7. **Measured metrics.** The Command Center numbers are computed from the
   memories actually stored, not asserted. (`test_command_center_matches_stored_memories`)

---

## Scoring

**Depth (0–10)** rewards breadth of critique and evidence:
loops run (≤5.0) + counterarguments (≤2.0) + connections (≤1.5) + sources (≤1.5).
Target: **8.0**.

**Confidence (0.05–0.95)** is evidence-led:
`0.30 + sources/12·0.40 + loops/5·0.20 − gaps·0.05`, clamped below certainty.

---

## NoblePort priority topics

Run recursive learning first on: PermitStream Municipal Expansion · NoblePort
Payment Node · NBPT Launch Strategy · Coastal Design-Build Intelligence ·
Construction Executive Operating System.

**Recommended first live pilot:** NoblePort 90-Day Growth Plan (Counterargument &
Reconciliation) — it touches construction revenue, PermitStream, Payment Node,
NobleNest, and Stephanie.ai adoption, so it surfaces the highest executive value
in the shortest time. NBPT tokenomics/governance materials are a starting dataset
only and **require legal validation before any production implementation.**

---

## API quick reference

```
POST /api/learning/learn                 # run a cycle from a free-form payload
POST /api/learning/priority-topic/{key}  # run a predefined priority topic
POST /api/learning/first-pilot           # run the 90-Day Growth Plan pilot
GET  /api/learning/command-center        # measured Command Center metrics
GET  /api/learning/memory                # stored memories (?due_for_review, ?topic)
GET  /api/learning/loops                 # the five loops
GET  /api/learning/knowledge-domains     # certification alignment (no claims)
GET  /api/learning/priority-topics       # priority topics + first pilot
```

Through the mesh, the same capability is reachable as events
(`run_learning_cycle`, `run_priority_topic`, `run_first_pilot`,
`get_command_center`, `get_memory`, …) routed to `RecursiveLearningAgent` and
recorded in AuditBeacon like every other mesh action.

## Success metric

The plan's bar: the system should not merely answer questions — each cycle should
demonstrably improve decisions, forecasts, risk identification, operational
outcomes, and profitability. The engine makes that measurable: depth and
confidence are scored per cycle, the Command Center tracks the trend against the
8.0 depth target, and the hash-chained memory log makes every claimed improvement
auditable after the fact.
