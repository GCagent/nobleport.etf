"""
Tests for Stephanie Orchestras (score conductor).

These run against a fake event router so they are fast and DB-free. They assert
the conductor's hard guarantees:

  - the shipped catalog is well-formed and advisory-only,
  - movements are dispatched in order through the mesh,
  - frozen commands are NEVER dispatched — they are staged for human approval,
  - a failed/gated *critical* movement aborts the rest of the score,
  - the performance summary matches the movements actually produced.
"""

from __future__ import annotations

import asyncio
from typing import Any

from backend.agents.orchestras import (
    SCORES,
    MovementStatus,
    OrchestraConductor,
    get_score,
    list_scores,
)
from backend.config.command_freeze import is_command_frozen


class FakeMesh:
    """Records routed events and returns a scripted success/failure."""

    def __init__(self, fail: set[str] | None = None) -> None:
        self.routed: list[str] = []
        self._fail = fail or set()

    async def route_event(self, event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        self.routed.append(event_type)
        success = event_type not in self._fail
        return {
            "event_type": event_type,
            "routed_to": "FakeFamily",
            "success": success,
            "result": {} if success else {"error": "scripted failure"},
            "duration_ms": 1.0,
        }


def _conduct(score_id: str, mesh: FakeMesh, context: dict[str, Any] | None = None) -> dict[str, Any]:
    return asyncio.run(OrchestraConductor(mesh).conduct(score_id, context or {}))


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

def test_catalog_is_wellformed_and_advisory():
    catalog = list_scores()
    assert catalog, "catalog must not be empty"
    for score in catalog:
        assert score["advisoryOnly"] is True
        assert score["movementCount"] == len(score["movements"])
        assert score["sections"], "every score touches at least one section"
        for movement in score["movements"]:
            # A gated movement must always document its human alternative.
            if movement["gated"]:
                assert movement["humanAlternative"]
                assert movement["gateReason"]


def test_get_score_unknown_returns_none():
    assert get_score("does-not-exist") is None


# ---------------------------------------------------------------------------
# Conducting
# ---------------------------------------------------------------------------

def test_conduct_routes_non_frozen_movements_in_order():
    mesh = FakeMesh()
    perf = _conduct("morning_executive", mesh)

    score = get_score("morning_executive")
    expected = [m.event_type for m in score.movements if not is_command_frozen(m.event_type)]
    assert mesh.routed == expected, "movements dispatched in declared order, frozen ones skipped"

    assert perf["summary"]["failed"] == 0
    assert perf["summary"]["health"] == "healthy"
    assert all(m["status"] == MovementStatus.COMPLETED for m in perf["movements"])


def test_frozen_movement_is_staged_not_dispatched():
    mesh = FakeMesh()
    perf = _conduct("deposit_to_production", mesh)

    # The payment movement is on the freeze list and must NOT be routed.
    assert "autonomous_payment_disbursement" not in mesh.routed

    payment = next(m for m in perf["movements"] if m["id"] == "payment")
    assert payment["status"] == MovementStatus.REQUIRES_APPROVAL
    assert payment["requiresHumanApproval"] is True
    assert "Alternative" in payment["detail"]
    assert perf["summary"]["requiresApproval"] == 1


def test_critical_failure_aborts_remaining_movements():
    # Fail the first (critical) movement of the permit sweep.
    mesh = FakeMesh(fail={"detect_permit_blockers"})
    perf = _conduct("permit_sweep", mesh)

    statuses = {m["id"]: m["status"] for m in perf["movements"]}
    assert statuses["blockers"] == MovementStatus.FAILED
    # Everything after a failed critical movement is skipped, nothing else routed.
    assert mesh.routed == ["detect_permit_blockers"]
    assert perf["summary"]["failed"] == 1
    assert perf["summary"]["skipped"] >= 1
    assert perf["summary"]["health"] == "unhealthy"


def test_unknown_score_raises():
    mesh = FakeMesh()
    try:
        _conduct("nope", mesh)
    except KeyError:
        pass
    else:
        raise AssertionError("conducting an unknown score must raise KeyError")


def test_summary_counts_match_movements():
    mesh = FakeMesh()
    perf = _conduct("intake_to_estimate", mesh)
    movements = perf["movements"]
    summary = perf["summary"]
    assert summary["total"] == len(movements)
    assert summary["completed"] == sum(
        1 for m in movements if m["status"] == MovementStatus.COMPLETED
    )
    assert summary["durationMs"] >= 0
