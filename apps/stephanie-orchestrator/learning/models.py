"""Data-transit models shared with the TypeScript verification core.

Field aliases are camelCase so payloads serialize byte-compatibly with the
`@nobleport/core` TypeScript interfaces; Python code uses snake_case via
``populate_by_name``.
"""

from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PythonTruthTier(str, Enum):
    T0_RAW_INGESTION = "T0_RAW_INGESTION"
    T1_PARSED_STRUCTURED = "T1_PARSED_STRUCTURED"
    T2_RAG_ENRICHED = "T2_RAG_ENRICHED"
    T3_AGENT_PROPOSED = "T3_AGENT_PROPOSED"
    T4_HUMAN_APPROVED = "T4_HUMAN_APPROVED"
    T5_CANONICAL_ANCHORED = "T5_CANONICAL_ANCHORED"


class PythonAgentCapability(str, Enum):
    L1_READ_ONLY = "L1_READ_ONLY"
    L2_DRAFT_PROPOSAL = "L2_DRAFT_PROPOSAL"
    L3_RECOMMEND_ACTION = "L3_RECOMMEND_ACTION"
    L4_EXECUTE_FINANCIAL = "L4_EXECUTE_FINANCIAL"


# Mirror of AUTHORITY_MATRIX in packages/nobleport-core/src/types/authority.ts.
AUTHORITY_MATRIX: Dict[PythonAgentCapability, Dict[str, Any]] = {
    PythonAgentCapability.L1_READ_ONLY: {
        "req_hitl": False,
        "default_tier": PythonTruthTier.T2_RAG_ENRICHED,
    },
    PythonAgentCapability.L2_DRAFT_PROPOSAL: {
        "req_hitl": False,
        "default_tier": PythonTruthTier.T3_AGENT_PROPOSED,
    },
    PythonAgentCapability.L3_RECOMMEND_ACTION: {
        "req_hitl": True,
        "default_tier": PythonTruthTier.T4_HUMAN_APPROVED,
    },
    PythonAgentCapability.L4_EXECUTE_FINANCIAL: {
        "req_hitl": True,
        "default_tier": PythonTruthTier.T4_HUMAN_APPROVED,
    },
}


class PythonCertificationContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    informed_by_frameworks: List[str] = Field(..., alias="informedByFrameworks")
    disclaimer_text: str = Field(..., alias="disclaimerText")
    requires_hitl_gate: bool = Field(..., alias="requiresHitlGate")
    assigned_capability_tier: PythonAgentCapability = Field(
        ..., alias="assignedCapabilityTier"
    )
    human_reviewer_license_type: Optional[str] = Field(
        None, alias="humanReviewerLicenseType"
    )


class AgentDecisionPayload(BaseModel):
    session_id: UUID
    capability_tier: PythonAgentCapability
    context: PythonCertificationContext
    proposed_action: Dict[str, Any]
    raw_payload_hash: str
