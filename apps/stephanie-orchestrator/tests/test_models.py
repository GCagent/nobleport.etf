import pytest

pytest.importorskip("pydantic")

from learning.models import (  # noqa: E402
    AUTHORITY_MATRIX,
    AgentDecisionPayload,
    PythonAgentCapability,
    PythonCertificationContext,
    PythonTruthTier,
)

CAMEL_CASE_CONTEXT = {
    "informedByFrameworks": ["CSL_Operational_Logic"],
    "disclaimerText": "Subject to licensed human review.",
    "requiresHitlGate": True,
    "assignedCapabilityTier": "L3_RECOMMEND_ACTION",
}


def test_context_parses_camel_case_aliases():
    ctx = PythonCertificationContext.model_validate(CAMEL_CASE_CONTEXT)
    assert ctx.requires_hitl_gate is True
    assert ctx.assigned_capability_tier is PythonAgentCapability.L3_RECOMMEND_ACTION
    assert ctx.human_reviewer_license_type is None


def test_context_round_trips_to_camel_case():
    ctx = PythonCertificationContext.model_validate(CAMEL_CASE_CONTEXT)
    dumped = ctx.model_dump(by_alias=True, exclude_none=True)
    assert dumped == CAMEL_CASE_CONTEXT


def test_context_accepts_snake_case_via_populate_by_name():
    ctx = PythonCertificationContext(
        informed_by_frameworks=["HERSRater_Framework"],
        disclaimer_text="x",
        requires_hitl_gate=False,
        assigned_capability_tier=PythonAgentCapability.L1_READ_ONLY,
    )
    assert ctx.informed_by_frameworks == ["HERSRater_Framework"]


def test_authority_matrix_covers_all_capabilities_and_gates_execution_tiers():
    execution_safe = {
        PythonTruthTier.T4_HUMAN_APPROVED,
        PythonTruthTier.T5_CANONICAL_ANCHORED,
    }
    for cap in PythonAgentCapability:
        entry = AUTHORITY_MATRIX[cap]
        if entry["default_tier"] in execution_safe:
            assert entry["req_hitl"] is True


def test_agent_decision_payload_validates():
    payload = AgentDecisionPayload(
        session_id="9c1f1c4e-0000-4000-8000-000000000001",
        capability_tier=PythonAgentCapability.L3_RECOMMEND_ACTION,
        context=PythonCertificationContext.model_validate(CAMEL_CASE_CONTEXT),
        proposed_action={"action": "GENERATE_RECOMMENDATION"},
        raw_payload_hash="a" * 64,
    )
    assert payload.capability_tier is PythonAgentCapability.L3_RECOMMEND_ACTION
