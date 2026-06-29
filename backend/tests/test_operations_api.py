"""
Tests for the Operations API (Revenue Spine route).

These exercise the route handlers directly with a fake Request whose
``app.state.agent_mesh`` carries a real (in-memory) AuditBeacon — so the
persistence path is genuinely tested without a database. They assert:

  - the gate refuses a restricted transition without approval (HTTP 409),
  - an approved restricted transition commits AND writes an audit record,
  - committed transitions are retrievable from the persisted activity trail,
  - propose is advisory and writes nothing.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.agents.audit_beacon import AuditBeaconAgent
from backend.api.operations import (
    ApprovalIn,
    CommitIn,
    ProposeIn,
    activity,
    commit,
    propose,
    stages,
)
from backend.operations.revenue_spine_workflow import RevenueStage


def _request_with_audit() -> tuple[SimpleNamespace, AuditBeaconAgent]:
    beacon = AuditBeaconAgent()
    req = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(agent_beacon=None, agent_mesh=SimpleNamespace(audit_beacon=beacon))))
    return req, beacon


def test_stages_lists_full_spine_with_restrictions():
    out = asyncio.run(stages())
    assert len(out["stages"]) == 15
    assert out["stages"][0]["stage"] == "lead"
    assert "contract_signed" in out["restrictedStages"]
    # Production Ready advertises its deposit guard.
    pr = next(s for s in out["stages"] if s["stage"] == "production_ready")
    assert "deposit_verified" in pr["guards"]
    assert pr["restricted"] is True


def test_propose_is_advisory_only():
    out = asyncio.run(propose(ProposeIn(
        from_stage=RevenueStage.CONTRACT_REVIEW,
        to_stage=RevenueStage.CONTRACT_SIGNED,
    )))
    assert out["decision"]["requiresApproval"] is True
    assert out["decision"]["allowed"] is True


def test_commit_restricted_without_approval_is_409():
    req, beacon = _request_with_audit()
    with pytest.raises(HTTPException) as exc:
        asyncio.run(commit(
            CommitIn(
                project_id="proj-1",
                from_stage=RevenueStage.CONTRACT_REVIEW,
                to_stage=RevenueStage.CONTRACT_SIGNED,
            ),
            req,
        ))
    assert exc.value.status_code == 409
    assert exc.value.detail["requiresApproval"] is True
    # Nothing persisted on a refused transition.
    assert len(beacon._chain) == 0


def test_commit_with_approval_persists_audit_record():
    req, beacon = _request_with_audit()
    out = asyncio.run(commit(
        CommitIn(
            project_id="proj-1",
            from_stage=RevenueStage.CONTRACT_REVIEW,
            to_stage=RevenueStage.CONTRACT_SIGNED,
            approval=ApprovalIn(approver="michael", role="owner", reason="counter-signed"),
            reason="counter-signed",
        ),
        req,
    ))
    assert out["committed"] is True
    assert out["stage"] == "contract_signed"
    assert out["auditRecord"]["status"] == "committed"
    # The audit record's document_hash is the workflow activity hash (linkage).
    assert len(beacon._chain) == 1
    assert beacon._chain[0]["document_hash"] == out["activityRecord"]["eventHash"]
    assert beacon._chain[0]["approval_type"] == "human"
    assert beacon._chain[0]["approved_by"] == "michael"


def test_committed_transition_is_retrievable_from_activity_trail():
    req, beacon = _request_with_audit()
    asyncio.run(commit(
        CommitIn(
            project_id="proj-42",
            from_stage=RevenueStage.LEAD,
            to_stage=RevenueStage.QUALIFICATION,
        ),
        req,
    ))
    trail = asyncio.run(activity("proj-42", req))
    assert trail["record_count"] == 1
    assert trail["records"][0]["subject_id"] == "proj-42"
    assert trail["records"][0]["action"] == "revenue_spine.transition.qualification"
