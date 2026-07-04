"""
Recursive Learning — NoblePort priority topics and the first live pilot.

These are the seed questions the integration plan prioritizes. They are data,
not executed actions: the engine runs them as analysis (SIMULATED / STAGED),
and any operational follow-through passes through the governance gate.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class PriorityTopic:
    key: str
    title: str
    goals: tuple[str, ...]
    loops: tuple[str, ...]
    note: str = ""

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


PRIORITY_TOPICS: tuple[PriorityTopic, ...] = (
    PriorityTopic(
        key="permitstream_municipal_expansion",
        title="PermitStream Municipal Expansion",
        goals=("Reduce permit cycle time", "Identify highest-value municipalities"),
        loops=("first_principles", "cross_domain", "executive_simulation"),
    ),
    PriorityTopic(
        key="nobleport_payment_node",
        title="NoblePort Payment Node",
        goals=(
            "Contractor payouts",
            "Stablecoin readiness",
            "Audit compliance",
        ),
        loops=("first_principles", "counterargument", "edge_case"),
        note="Touches Finance + Governance; outputs stage for licensed review.",
    ),
    PriorityTopic(
        key="nbpt_launch_strategy",
        title="NBPT Launch Strategy",
        goals=("Demand creation", "Regulatory pathways", "Governance structure"),
        loops=("first_principles", "counterargument", "executive_simulation"),
        note=(
            "Tokenomics/governance materials are a starting dataset only and "
            "require legal validation before any production implementation."
        ),
    ),
    PriorityTopic(
        key="coastal_design_build_intelligence",
        title="Coastal Design-Build Intelligence",
        goals=(
            "Flood resilience",
            "Insurance trends",
            "Permitting",
            "Construction sequencing",
        ),
        loops=("first_principles", "edge_case", "cross_domain"),
    ),
    PriorityTopic(
        key="construction_executive_os",
        title="Construction Executive Operating System",
        goals=(
            "Unify PermitStream.ai, GCagent.ai, Stephanie.ai, NobleNest, "
            "and Payment Node into a single operating layer",
        ),
        loops=("first_principles", "cross_domain", "executive_simulation"),
    ),
)

PRIORITY_TOPICS_BY_KEY: dict[str, PriorityTopic] = {t.key: t for t in PRIORITY_TOPICS}


# Recommended first live pilot.
FIRST_PILOT = PriorityTopic(
    key="nobleport_90_day_growth_plan",
    title="NoblePort 90-Day Growth Plan",
    goals=(
        "Construction revenue",
        "PermitStream deployment",
        "Payment Node rollout",
        "NobleNest growth",
        "Stephanie.ai adoption",
    ),
    loops=("counterargument", "first_principles", "executive_simulation"),
    note=(
        "Counterargument & Reconciliation pilot — touches every business line, "
        "so it surfaces the highest executive value in the shortest time."
    ),
)
