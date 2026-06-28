# Reflection Engine — Verified Experience → Better Operational Knowledge

**Status:** STAGED / Human-Approved Execution.
**Final decision authority:** Michael F. O'Rourke.
**Code:** [`backend/learning/reflection.py`](../../backend/learning/reflection.py)
· **Tests:** [`backend/tests/test_reflection.py`](../../backend/tests/test_reflection.py)

The [Recursive Learning Engine](./recursive-learning-engine.md) reasons over a
*question*. The Reflection Engine closes the other half of the loop: it reflects
over a **completed project's evidence** and converts what actually happened into
**proposed operational improvements** — not stored chat history, but better SOPs,
pricing, estimating, risk models, proposal templates, and inspection checklists.

This is the difference between:

> Experience → Store

and what the architecture actually asks for:

> Experience → Analyze → Learn → Improve → Update Standards → Apply Again

…with one hard constraint: **the engine proposes; a human applies.**

---

## The closed loop

```
Observe → Remember → Reason → Reflect → Improve → Test → Validate → Teach → (repeat)
```

Encoded as `REFLECTION_LOOP`. `Teach` feeds the next project's `Observe` — the
loop is continuous. Operationally, per project:

1. Finish a project.
2. Extract the evidence — photos, contracts, permits, proposals, invoices,
   voice, inspections, payments (`EvidenceType`).
3. Compare it to historical patterns (the shared hash-chained memory store).
4. Identify what changed (`ReflectionSignal`, `changed=True`).
5. Draft updated procedures (`ProposedImprovement`, STAGED).
6. **Present important changes for human approval.** ← the HITL gate.
7. Apply the **approved** improvements on the next project.

---

## The seven memory layers

Classification is encoded as `MemoryLayer` with `MEMORY_LAYER_PURPOSE`:

| Layer | Purpose |
|-------|---------|
| Episodic | Individual jobs, conversations, inspections, proposals |
| Semantic | Construction knowledge, code interpretations, municipal processes, estimating |
| Procedural | SOPs, workflows, checklists, payment schedules, proposal generation |
| Financial | Margins, job costing, vendor pricing, cash flow, revenue patterns |
| Governance | HITL approvals, audit history, policy changes, evidence ledger |
| Reflection | Lessons learned, recurring mistakes, successful approaches |
| Strategy | Long-term business goals, product roadmap, market opportunities |

---

## The hard guarantees (enforced, not described)

1. **Human-in-the-loop — proposes, never applies.** Every improvement is created
   STAGED and `PROPOSED`. `apply_improvement()` fails closed (`PermissionError`)
   on anything not explicitly `APPROVED` by a named human. The approve → apply
   path is the *only* route to `APPLIED`.
   (`test_unapproved_improvement_cannot_be_applied`,
   `test_approve_then_apply_is_the_only_path_to_applied`)
2. **Evidence-gated.** Only *verified* evidence can back a change. A signal whose
   supporting evidence is missing or unverified is downgraded to a knowledge gap
   and recorded — never turned into a standards update.
   (`test_unverified_evidence_does_not_drive_change`)
3. **Never LIVE.** Reflection output and the stored episode are STAGED; standards
   changes are draft-state until a human signs off.
   (`test_every_reflection_writes_a_tamper_evident_memory`)
4. **Regulated changes name a licensed reviewer.** A pricing/estimating change
   routes to a financial reviewer; a risk-model change to a governance reviewer —
   reusing the knowledge-domain credential map (no credential is ever claimed).
   (`test_pricing_change_requires_financial_reviewer`)
5. **Recursive, not amnesiac.** "Compare against every previous project" is a real
   lookup: each cycle's per-target memory is hash-chained, and a later cycle's
   improvement records the prior memory it `supersedes`.
   (`test_second_cycle_supersedes_prior_knowledge_for_same_target`)
6. **Auditable memory.** Every reflection writes a SHA-256 hash-chained memory
   via the shared `RecursiveMemoryStore`; tampering breaks `verify_chain()`.

---

## What it does not do

It does not fabricate lessons. Like the recursive-learning engine, it structures
and governs observations the caller supplies from real project data
(`ReflectionSignal`), gates them on verified evidence, and routes the meaningful
ones to a human. It is scaffolding for closed-loop learning — the mesh-agent and
API wiring (so reflections run automatically at closeout and surface in the
Command Center) is the honest next step, not yet built.

---

## Verify it yourself

```bash
python -m pytest backend/tests/test_reflection.py -q
```
