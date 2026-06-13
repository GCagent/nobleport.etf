"""
Stephanie.ai Governance Layer

Executable implementation of the Stephanie.ai Architecture v2 governance spec:
Truth-Layer tagging, the Authority Matrix, the credential register, the
five-step decision gate (fail-closed), and measured governance metrics.

Public surface:
    TruthTag, StephanieGate, ActionRequest, GateDecision,
    AUTHORITY_MATRIX, CREDENTIAL_REGISTER, Lane,
    compute_metrics, run_baseline
"""

from __future__ import annotations

from backend.governance.attestation_registry import (
    ATTESTATION_REGISTRY,
    AttestationCategory,
    AttestationRecord,
    AttestationStatus,
    registry_summary,
    validate_registry,
)
from backend.governance.authority_matrix import (
    AUTHORITY_MATRIX,
    CREDENTIAL_REGISTER,
    Disposition,
    Lane,
)
from backend.governance.metrics import GovernanceMetrics, compute_metrics
from backend.governance.scenarios import SCENARIO_SUITE
from backend.governance.stephanie_gate import ActionRequest, GateDecision, StephanieGate
from backend.governance.truth_layer import TruthTag

__all__ = [
    "TruthTag",
    "Lane",
    "Disposition",
    "StephanieGate",
    "ActionRequest",
    "GateDecision",
    "AUTHORITY_MATRIX",
    "CREDENTIAL_REGISTER",
    "GovernanceMetrics",
    "compute_metrics",
    "SCENARIO_SUITE",
    "run_baseline",
    "ATTESTATION_REGISTRY",
    "AttestationRecord",
    "AttestationStatus",
    "AttestationCategory",
    "registry_summary",
    "validate_registry",
]


def run_baseline() -> tuple[StephanieGate, GovernanceMetrics]:
    """
    Process the full scenario suite through a fresh gate and compute real
    metrics from the resulting decisions. Returns (gate, metrics) so callers
    can also inspect the audit ledger.
    """
    gate = StephanieGate()
    for request in SCENARIO_SUITE:
        gate.process(request)
    metrics = compute_metrics(gate.ledger, chain_intact=gate.verify_chain())
    return gate, metrics
