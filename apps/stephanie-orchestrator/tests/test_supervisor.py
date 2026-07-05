import hashlib
import json

import pytest

pytest.importorskip("pydantic")

from agents import supervisor  # noqa: E402


def test_regulated_transcript_routes_to_hitl_gate():
    update = supervisor.stephanie_brain_node(
        {"transcript_input": "We need a structural permit for the addition."}
    )
    assert update["current_capability"] == "L3_RECOMMEND_ACTION"
    assert update["hitl_required"] is True
    assert update["certification_context"]["requiresHitlGate"] is True
    assert supervisor.route_authority_layer(update) == "hitl_gate_node"


def test_general_transcript_routes_to_execution():
    update = supervisor.stephanie_brain_node(
        {"transcript_input": "What time does the crew arrive tomorrow?"}
    )
    assert update["current_capability"] == "L1_READ_ONLY"
    assert update["hitl_required"] is False
    assert supervisor.route_authority_layer(update) == "execution_node"


def test_resolved_hitl_state_proceeds_to_execution():
    state = {"hitl_required": True, "execution_resolved": True}
    assert supervisor.route_authority_layer(state) == "execution_node"


def test_audit_hash_is_canonical_sha256_of_decision():
    update = supervisor.stephanie_brain_node({"transcript_input": "change order"})
    expected = hashlib.sha256(
        json.dumps(
            update["proposed_decision"], sort_keys=True, separators=(",", ":")
        ).encode()
    ).hexdigest()
    assert update["audit_hash"] == expected


def test_hitl_gate_pauses_and_execution_resolves():
    assert supervisor.hitl_gate_node({}) == {"execution_resolved": False}
    assert supervisor.execution_node({}) == {"execution_resolved": True}


def test_compiled_graph_end_to_end():
    langgraph = pytest.importorskip("langgraph")  # noqa: F841
    executor = supervisor.build_graph()

    gated = executor.invoke(
        {"session_id": "s1", "transcript_input": "approve the change order financials"}
    )
    assert gated["hitl_required"] is True
    assert gated["execution_resolved"] is False

    resolved = executor.invoke(
        {"session_id": "s2", "transcript_input": "hello stephanie"}
    )
    assert resolved["execution_resolved"] is True
