"""
NoblePort OS Agent Layer

The agent mesh that forms NoblePort's operating system.
Each agent is a lightweight service class with well-defined interfaces
for construction operations intelligence.

Agent families:
  - Stephanie.ai    : Front door, intake, revenue ops, executive voice
  - GCagent.ai      : Construction execution intelligence
  - PermitStream.ai : Permit/zoning/compliance intelligence
  - Cyborg.ai       : Security, governance, risk verification
  - AuditBeacon     : Immutable operational memory (hash-chain ledger)
  - RecursiveLearningAgent : Recursive executive operator (self-learning loop)
  - JourneyAgent    : Story Engine — operational artifacts → content assets

The Orchestrator (AgentMesh) wires them together and provides
a unified routing and health surface for Mission Control.
"""

from backend.agents.base import AgentFamily, AgentStatus, BaseAgent
from backend.agents.stephanie import StephanieAgent
from backend.agents.gcagent import GCAgent
from backend.agents.permit_stream import PermitStreamAgent
from backend.agents.cyborg import CyborgAgent
from backend.agents.audit_beacon import AuditBeaconAgent
from backend.agents.recursive_learning import RecursiveLearningAgent
from backend.agents.journey import JourneyAgent
from backend.agents.truth_auditor import TruthAuditorAgent
from backend.agents.orchestrator import AgentMesh

__all__ = [
    "AgentFamily",
    "AgentStatus",
    "BaseAgent",
    "StephanieAgent",
    "GCAgent",
    "PermitStreamAgent",
    "CyborgAgent",
    "AuditBeaconAgent",
    "RecursiveLearningAgent",
    "JourneyAgent",
    "TruthAuditorAgent",
    "AgentMesh",
]
