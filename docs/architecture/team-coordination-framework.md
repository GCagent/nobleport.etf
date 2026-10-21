# NoblePort Team Coordination Framework

> How the NoblePort agent team coordinates: who owns what, how work hands off,
> what gets verified, and where humans stay in the loop.
>
> This document describes the coordination contract for the five-agent mesh
> that is **already implemented** in `backend/agents/`. It is the operating
> agreement, not a proposal. Where a behavior is modeled rather than wired to a
> live external system, it is labeled **(modeled)** so verified production
> reality stays separated from intent — per the discipline in
> [`docs/strategy/strategic-positioning.md`](../strategy/strategic-positioning.md).

---

## 1. The team

NoblePort runs as a **Supervisor / Worker** mesh with an always-on audit spine.
One coordinator owns intake and routing; specialist workers own their domains;
a governance agent gates sensitive actions; an audit agent records everything.

| Agent | Family | Role | Authority | Code |
|-------|--------|------|-----------|------|
| **Stephanie.ai** | `Stephanie` | Front door, intake, executive voice, operational router, telemetry, trust coordinator | Routes work; may draft and approve within delegated limits; never the final gate on money or filings | `backend/agents/stephanie.py` |
| **GCagent.ai** | `GCagent` | Construction execution intelligence | Read/write on job state; assists and recommends; never auto-approves change orders or payments | `backend/agents/gcagent.py` |
| **PermitStream.ai** | `PermitStream` | Permit / zoning / compliance intelligence (MA-focused) | Read-only intelligence; forecasts, risk scores, blocker detection; never submits filings | `backend/agents/permit_stream.py` |
| **Cyborg.ai** | `Cyborg` | Security, governance, risk verification | Verifies actions against policy; arms/enforces kill switches; can **block** | `backend/agents/cyborg.py` |
| **AuditBeacon** | `AuditBeacon` | Immutable operational memory (hash-chain ledger) | Append-only record of every routed event; verifies chain integrity | `backend/agents/audit_beacon.py` |

This is the team in your framing: Stephanie coordinates the big picture, GCagent
helps operationally, PermitStream handles permit logic, and Cyborg ensures
compliance and security — with AuditBeacon making the whole thing provable.

---

## 2. The coordination kernel

All coordination flows through one kernel: `AgentMesh`
(`backend/agents/orchestrator.py`). The mesh holds references to all five
agents and is the only component that routes between them. Agents do **not**
call each other directly — they coordinate through the mesh. That keeps the
interaction graph a star, not a web, so every hand-off is observable and
auditable at one choke point.

```
                         ┌─────────────────────────┐
        event ──────────▶│        AgentMesh        │
                         │   route_event(type, …)  │
                         └────────────┬────────────┘
                                      │  EVENT_ROUTING table
              ┌───────────────┬───────┼────────────┬───────────────┐
              ▼               ▼       ▼            ▼               ▼
        Stephanie.ai     GCagent.ai  PermitStream  Cyborg.ai   AuditBeacon
        (front door /    (build /    (permit /     (verify /   (record every
         router)          field)      zoning)       gate)        event)
                                      │
                                      ▼
              every non-audit event is also written to AuditBeacon
              (record_event) — see orchestrator.route_event()
```

### Routing rules

1. **Typed events route by table.** `EVENT_ROUTING` in `orchestrator.py` maps
   each event type to exactly one owning family (e.g. `permit_submitted →
   PermitStream`, `verify_action → Cyborg`, `job_activated → GCagent`).
2. **Unknown events fall to Stephanie.** She is the front door; anything
   unrecognized is hers by default (`EVENT_ROUTING.get(type, STEPHANIE)`).
3. **Stephanie can re-route.** Her `route_task` handler
   (`stephanie.py`) classifies free-form tasks and names a `target_agent`,
   which the mesh then dispatches. This is the supervisor assigning a worker.
4. **Every event is audited.** `route_event` records each non-audit event to
   AuditBeacon with actor, action, subject, and approval type. The only events
   skipped are `record_event` itself (recursion guard) and events already owned
   by AuditBeacon.
5. **Broadcast exists for fan-out.** `AgentMesh.broadcast` runs one event across
   all agents (used for system-wide signals like a global kill switch).

---

## 3. The revenue spine and ownership hand-offs

Coordination exists to move one sequence forward — the **revenue spine**:

```
Lead → Intake → Estimate → Permit → Build → Invoice → Closeout
```

Each stage has a single owner of record and an explicit hand-off. The hand-off
is an event through the mesh, not a side conversation.

| Stage | Owner | Hands off to | Trigger event(s) | Gate before advancing |
|-------|-------|--------------|------------------|-----------------------|
| Lead → Intake | Stephanie | Stephanie (qualifies/routes) | `lead_created`, `route_intake` | — |
| Estimate | Stephanie | Cyborg (verify) → human | `estimate_created`, `estimate_sent`, `estimate_approved` | Human approval above review limit |
| Permit | PermitStream | GCagent (clears build) | `permit_submitted`, `permit_status_changed`, `assess_permit_risk` | **permit-before-build** policy |
| Build | GCagent | Stephanie (invoice) | `job_activated`, `schedule_changed`, `cost_recorded` | **deposit-before-build**, **co-approval-before-work** |
| Invoice | Stephanie | Cyborg (verify) → human | `estimate_won`, payment events | Human approval on high-value / refunds |
| Closeout | GCagent → Stephanie | AuditBeacon (seal) | job completion, `record_event` | Audit trail complete |

**Hand-off contract.** When one agent finishes its stage, it does not mutate
the next stage's state. It emits the stage-completion event; the mesh routes it
to the next owner; AuditBeacon records the transition. This is why
`construction_operations` declares *"Buildertrend is source of truth; conflicts
escalate, they do not overwrite"* (`gcagent/config/module_registry.yaml`) — the
same non-overwrite discipline applies between agents.

---

## 4. The governance gate (Cyborg)

Cyborg is the team's compliance-and-security layer. Sensitive actions pass
through `verify_action` before they execute. Cyborg returns one of three
decisions — `allowed`, `requires_approval`, or `blocked` — plus a trust level
and any policy violations (`VerificationResult` in `cyborg.py`).

**Financial thresholds** (`FINANCIAL_THRESHOLDS`):

| Band | Limit | Outcome |
|------|-------|---------|
| Auto-approve | ≤ $5,000 | Allowed (still recorded) |
| Elevated review | ≤ $25,000 | Human approval required |
| Executive approval | ≤ $100,000 | Executive sign-off |
| Above executive | > $100,000 | Blocked pending escalation |

**Enforced policy rules** (`_POLICY_RULES`):

- `deposit-before-build` — deposit collected before a job activates.
- `permit-before-build` — permit issued before construction (unless exempt).
- `co-approval-before-work` — change orders approved before work begins.
- `human-approval-high-value` — human approval above the elevated-review limit.
- `dual-approval-refunds` — refunds require two approvers.

**Role-based authorization** (`AUTHORIZATION_MATRIX`) scopes what each human
*and each agent* may do. Notably the agents are themselves bounded: `gcagent`
holds `read, write`; `permitstream` holds `read` only; `stephanie` may approve
estimates and change orders but the matrix never grants any agent the
unilateral high-value financial authority that the policy rules reserve for
humans. The framework's safety posture is therefore **defense in depth**: the
authorization matrix limits *who can attempt*, the policy rules limit *what
auto-completes*, and the kill switches limit *what runs at all*.

**Kill switches.** Cyborg owns scoped kill switches (`enforce_kill_switch`).
When armed, a scope (e.g. estimate creation/approval) is paused mesh-wide.
`kill_switch_armed` surfaces in every agent's telemetry so Mission Control shows
the state at a glance.

---

## 5. The audit spine (AuditBeacon)

Every routed event becomes an append-only record in AuditBeacon's hash-chain
ledger, capturing **what happened, who/what did it, what approved it**
(`approval_type`, `approved_by`, `approval_reason`). Two properties make the
coordination trustworthy:

- **Provenance.** Each record names the actor, actor type, agent family,
  action, and subject — so any state in the system can be traced back to the
  event and approval that produced it.
- **Integrity.** `verify_chain_integrity` re-walks the hash chain; a broken link
  means tampering or loss. This is what lets compliance reconstruct a decision
  chain deterministically, the success criterion in the
  `compliance_documentation` module.

Audit is not optional and not after-the-fact: it is wired into the routing call
itself, so an event cannot be coordinated without being recorded.

---

## 6. Human-in-the-loop boundaries

The team assists, analyzes, and drafts. It does **not** autonomously execute
financial transactions, legal filings, permit submissions, or contract
generation — those cross a human approval gate. This is stated in GCagent's
system prompt (`gcagent/system_prompt.md`, Block 1) and enforced structurally by
Cyborg's policy rules and authorization matrix.

| Action class | Agent role | Human gate |
|--------------|-----------|------------|
| Permit submission | PermitStream forecasts/flags; never submits | Required |
| Financial transaction | Stephanie/GCagent draft; Cyborg verifies | Required above review limit; dual for refunds |
| Change-order approval | GCagent recommends | Required before work begins |
| External customer comms | Internal Ops drafts | Required before send (`internal_ops_assistant` safety rules) |
| Investor-visible comms | Investor Admin prepares | Required before send (`investor_admin_workflows` safety rules) |

---

## 7. Health, heartbeat, and degradation

Coordination degrades gracefully because every agent reports the same telemetry
(`AgentTelemetry` in `backend/agents/base.py`): status, health, queue depth,
in-flight count, p95 latency, error rate, kill-switch state, current task.

- **Health is derived, not asserted.** `_recalculate_health` downgrades an agent
  to `degraded` at >10% error rate or >100 queued, and `unhealthy` on
  error/offline (`base.py`).
- **The mesh reports worst-of-all.** `get_system_health` classifies the whole
  system by its least-healthy member, so a single degraded specialist is
  visible at the top level rather than averaged away.
- **Mission Control consumes the summary.** `get_agent_mesh_summary` and
  `get_agent_list` produce exactly the shapes the frontend expects, keeping the
  operational picture honest end to end.

---

## 8. Coordination invariants

The rules that must always hold for the team to stay trustworthy:

1. **One owner per event.** Routing is deterministic; no event is handled twice
   by two families (audit excepted, which records *in addition*).
2. **No direct agent-to-agent calls.** All coordination goes through the mesh,
   so the interaction graph stays observable.
3. **No silent overwrites across stages.** Hand-offs emit events; conflicts
   escalate, they do not clobber a downstream owner's state.
4. **Every coordinated event is recorded** before its effects are trusted.
5. **Sensitive actions are verified by Cyborg** and gated by policy before they
   complete.
6. **Humans hold the final gate** on money, filings, permits, and contracts.
7. **Append-only, versioned corrections.** Reports and audit trails are
   re-issued, never edited in place (`reporting_automation`, `audit_beacon`).

---

## 9. Worked example — a change order on a live job

1. Field supervisor submits a change order → `change_order_requested` (modeled
   intake) reaches the mesh.
2. Mesh routes construction context to **GCagent**, which assesses cost variance
   and scope-creep impact and produces a recommendation — it does **not**
   approve.
3. GCagent's recommendation triggers `verify_action` → **Cyborg**. Cyborg checks
   `co-approval-before-work` and the financial band. Below auto-approve limit and
   policy-clean → `allowed`; otherwise `requires_approval`.
4. If approval is required, the item waits at the **human gate**. No build work
   advances (policy enforced).
5. On human approval, **Stephanie** moves the spine forward (invoice/schedule).
6. **AuditBeacon** has recorded each step — request, recommendation,
   verification, approval — so the change order's full decision chain is
   reconstructable.

---

## 10. Status and boundaries

- **Implemented:** the five-agent mesh, deterministic event routing, Cyborg
  policy/threshold/kill-switch verification, AuditBeacon hash-chain recording,
  and aggregate health telemetry — all in `backend/agents/`.
- **Modeled:** specific external intake events (e.g. `change_order_requested`)
  and live integrations are represented in agent logic but depend on connected
  systems (Buildertrend, HubSpot, payment rails) to be fully end-to-end.
- **Out of scope here:** token, validator, and sovereign-mesh narratives. Per
  the strategic positioning doc, the durable value is the operational
  orchestration above — this framework documents that, and nothing speculative.

---

*See also:* [`gcagent/system_prompt.md`](../../gcagent/system_prompt.md) ·
[`gcagent/config/module_registry.yaml`](../../gcagent/config/module_registry.yaml) ·
[`backend/agents/orchestrator.py`](../../backend/agents/orchestrator.py) ·
[`docs/strategy/strategic-positioning.md`](../strategy/strategic-positioning.md)
