# AI Construction Internal Tracking Agents

Ten config-driven, edge-deployable field-telemetry agents that watch a job site
in real time and distill raw sensor / event streams into structured, actionable
outputs. Their distilled outputs feed the heavier DB-backed execution agents
(e.g. **GCagent**) and Mission Control.

> Source of truth: [`backend/agents/tracking/config.json`](../../backend/agents/tracking/config.json)
> · Code: [`backend/agents/tracking/`](../../backend/agents/tracking/)
> · Tests: [`backend/tests/test_tracking_agents.py`](../../backend/tests/test_tracking_agents.py)

## Why a separate mesh

These agents are deliberately **I/O-free and deterministic** so they can run on
edge hardware (cameras, gateways, wearables) and be unit-tested without a
database or network. They are kept distinct from the DB-backed `AgentMesh` in
`backend/agents/orchestrator.py`. The parent `backend.agents` package imports
its DB-backed agents lazily (PEP 562), so `import backend.agents.tracking` works
with **no SQLAlchemy / settings dependency**.

## The ten agents

| # | Agent | Function | Trigger | Retention |
|---|-------|----------|---------|-----------|
| 1 | Schedule | Auto-update schedule from IoT/RFID scans | continuous | 90 d |
| 2 | Cost | Real-time earned-value analysis + overrun alerts | hourly | 365 d |
| 3 | Document | Classify RFIs/submittals/COs, auto-route | continuous | 730 d |
| 4 | Inventory | JIT reorder triggers from drone/scale data | daily 06:00 + on-demand | 180 d |
| 5 | Equipment | Predictive maintenance from vibration/temp | continuous | 365 d |
| 6 | Labor | Attendance + productivity heatmaps (anonymized) | continuous | 60 d |
| 7 | Quality | AI-vision defect detection, NCR drafting | continuous | 365 d |
| 8 | Safety | Real-time PPE violations + root-cause mining | continuous (<1s) | 730 d |
| 9 | Subcontractor | Daily scorecard from schedule/quality/safety | daily 23:59 | 365 d |
| 10 | Daily Field | NL daily report + photo timelapse | daily 18:00 | 365 d |

Agents 9–10 are **cross-agent**: they consume the outputs of the others rather
than raw field signals. The mesh assembles their inputs.

## Architecture

```
field signal ──▶ TrackingMesh.dispatch ──▶ [agents that accept the source]
                                              │
                                  list[AgentOutput]  (severity, alert, retain_until,
                                              │        requires_human_approval)
            ┌─────────────────────────────────┼─────────────────────────────┐
            ▼                                  ▼                             ▼
  score_subcontractors()            daily_field_report()            sweep_expired()
  (scorecard 0–100 + flag)        (narrative rollup + weather)   (per-agent retention)
```

| Module | Responsibility |
|--------|----------------|
| `config.json` | Canonical 10-agent definition + global settings |
| `spec.py` | Typed schema, trigger parsing, cached loader |
| `base.py` | `Signal` / `AgentOutput` / `Severity`, retention, human-approval gate |
| `agents.py` | The ten concrete implementations + `AGENT_CLASSES` map |
| `framing.py` | Wall-framing cost estimator (feeds the Cost Agent) |
| `registry.py` | `TrackingMesh`: dispatch, rollups, retention, summary |

## Governance hooks (from `global_settings`)

- **`fallback_mode: human approval for high-cost actions`** — outputs an agent
  declares as high-cost (`InventoryAgent` auto-PO drafts, `EquipmentAgent` work
  orders, `CostAgent` change-order simulations) are stamped
  `requires_human_approval=True`.
- **`alert_channel: Teams / Slack / SMS`** — parsed into `alert_channels`; any
  output at severity `HIGH`+ is flagged `alert=True` for fan-out.
- **`edge_processing` / `digital_twin_integration`** — surfaced in `summary()`.
- **Privacy** — the Labor Agent never propagates raw identifiers; only the
  anonymized role ID survives into outputs (enforced by test).

## Usage

```python
from backend.agents.tracking import create_tracking_mesh, Signal

mesh = create_tracking_mesh()

# 1) Dispatch a field signal — routed to every agent whose input_sources match.
outputs = mesh.dispatch(Signal(
    source="RFID tags on materials/equipment",
    kind="scan",
    payload={"task_id": "T-100", "percent_complete": 40,
             "planned_percent_complete": 65, "predicted_slip_days": 6},
))

# 2) Nightly subcontractor scorecards (cross-agent aggregation).
mesh.score_subcontractors({
    "SUB-A": {"schedule_adherence": 0.95, "quality_pass_rate": 0.98,
              "safety_violations": 0, "previous_score": 90},
})

# 3) End-of-shift Daily Field report rolls up the day's outputs.
mesh.daily_field_report(outputs, weather={"summary": "Rain", "precip_in": 0.5},
                        photo_count=12)

# 4) Retention sweep partitions stored outputs by each agent's window.
retained, expired = mesh.sweep_expired(stored_outputs)
```

## Wall-framing cost estimator

`framing.py` reproduces the RSMeans-style **"Cost to Frame a Wall"** take-off and
rolls it to a low/high range and average cost per square foot. The **Cost Agent**
consumes it (`kind="framing_estimate"`) to attach a defensible budget baseline to
framing scope and flag out-of-band bids.

Reference basis (national average, May 2026, 125 SF wall, 16" OC):

| Item | Qty | Low | High |
|------|-----|-----|------|
| Wall framing labor (basic) | 4.4 h | $237 | $503 |
| Wall framing job supplies | 134 SF | $217 | $247 |
| Equipment allowance (nailer, miter saw, planer) | 1 job | $50 | $75 |
| **Total (125 SF)** | | **$504** | **$825** |
| **Average cost / SF** | | **$4.03** | **$6.60** |

```python
from backend.agents.tracking import estimate_wall_framing

est = estimate_wall_framing(125, zip_code="47474")
est.total_low, est.total_high          # 504.0, 825.0
est.cost_per_sf_low, est.cost_per_sf_high  # 4.03, 6.60
```

Labor and supplies scale per wall SF; supplies carry a ~7.2% waste factor
(134 SF billed for 125 SF of wall); equipment is a fixed daily allowance, so the
per-SF rate dips slightly as wall area grows.

## Testing

```bash
python -m pytest backend/tests/test_tracking_agents.py -q   # 20 tests
```
