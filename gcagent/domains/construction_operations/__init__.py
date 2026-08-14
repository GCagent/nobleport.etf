"""Runtime scaffold for the `construction_operations` domain module.

Contract: see `gcagent/config/module_registry.yaml` (id: construction_operations).
Layer: domain.
"""

from .agents import (
    ChangeOrderAgent,
    ComplianceAgent,
    DispatchAgent,
    FieldDocumentationAgent,
    FinancialRiskAgent,
    ProcurementAgent,
    QAQCAgent,
    SafetyAgent,
    SchedulerAgent,
)

MODULE_ID = "construction_operations"
LAYER_ID = "domain"

DEFAULT_AGENTS = (
    SchedulerAgent,
    SafetyAgent,
    ProcurementAgent,
    QAQCAgent,
    FinancialRiskAgent,
    ChangeOrderAgent,
    FieldDocumentationAgent,
    DispatchAgent,
    ComplianceAgent,
)


def build_default_agents() -> list:
    """Instantiate the canonical agent fleet for a project."""
    return [agent_cls() for agent_cls in DEFAULT_AGENTS]


__all__ = [
    "ChangeOrderAgent",
    "ComplianceAgent",
    "DEFAULT_AGENTS",
    "DispatchAgent",
    "FieldDocumentationAgent",
    "FinancialRiskAgent",
    "ProcurementAgent",
    "QAQCAgent",
    "SafetyAgent",
    "SchedulerAgent",
    "build_default_agents",
    "MODULE_ID",
    "LAYER_ID",
]
