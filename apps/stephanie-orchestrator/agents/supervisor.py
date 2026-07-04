"""Stephanie supervisor graph: brain -> (HITL gate | execution).

Node functions and routing are pure so they can be unit-tested without
langgraph installed; the compiled graph is built lazily in ``build_graph``.
The audit hash uses canonical JSON (sorted keys, compact separators) to match
``CryptographicCore.calculateSHA256`` in @nobleport/core.
"""

import hashlib
import json
from typing import Any, Dict, TypedDict

from learning.models import AUTHORITY_MATRIX, PythonAgentCapability

REGULATED_KEYWORDS = ("permit", "insulate", "structural", "financial", "order")

REGULATED_DISCLAIMER = (
    "Analysis informed by CSL operational patterns and HERS Rater frameworks. "
    "Subject to licensed human review."
)
GENERAL_DISCLAIMER = "General informational response."


class AgentState(TypedDict, total=False):
    session_id: str
    transcript_input: str
    current_capability: str
    certification_context: Dict[str, Any]
    proposed_decision: Dict[str, Any]
    hitl_required: bool
    execution_resolved: bool
    audit_hash: str


def canonical_hash(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def route_authority_layer(state: AgentState) -> str:
    if state.get("hitl_required") and not state.get("execution_resolved"):
        return "hitl_gate_node"
    return "execution_node"


def stephanie_brain_node(state: AgentState) -> Dict[str, Any]:
    transcript = state.get("transcript_input", "")
    is_regulated = any(k in transcript.lower() for k in REGULATED_KEYWORDS)

    capability = (
        PythonAgentCapability.L3_RECOMMEND_ACTION
        if is_regulated
        else PythonAgentCapability.L1_READ_ONLY
    )
    hitl_req = AUTHORITY_MATRIX[capability]["req_hitl"]
    disclaimer = REGULATED_DISCLAIMER if is_regulated else GENERAL_DISCLAIMER

    proposed_action = {
        "action": "GENERATE_RECOMMENDATION",
        "target": "AWO_PROPOSAL",
        "value": 4500.00,
    }

    return {
        "current_capability": capability.value,
        "certification_context": {
            "informedByFrameworks": ["CSL_Operational_Logic", "HERSRater_Framework"],
            "disclaimerText": disclaimer,
            "requiresHitlGate": hitl_req,
            "assignedCapabilityTier": capability.value,
        },
        "proposed_decision": proposed_action,
        "hitl_required": hitl_req,
        "audit_hash": canonical_hash(proposed_action),
    }


def hitl_gate_node(state: AgentState) -> Dict[str, Any]:
    # Halts the run; resolution arrives out-of-band from the HITL console.
    return {"execution_resolved": False}


def execution_node(state: AgentState) -> Dict[str, Any]:
    return {"execution_resolved": True}


def build_graph():
    from langgraph.graph import END, StateGraph

    workflow = StateGraph(AgentState)
    workflow.add_node("stephanie_brain", stephanie_brain_node)
    workflow.add_node("hitl_gate_node", hitl_gate_node)
    workflow.add_node("execution_node", execution_node)

    workflow.set_entry_point("stephanie_brain")
    workflow.add_conditional_edges("stephanie_brain", route_authority_layer)
    workflow.add_edge("hitl_gate_node", END)
    workflow.add_edge("execution_node", END)

    return workflow.compile()


try:
    stephanie_agent_executor = build_graph()
except ImportError:  # langgraph not installed; pure logic stays importable
    stephanie_agent_executor = None
