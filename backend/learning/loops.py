"""
Recursive Learning — workflow stages and learning loops.

The engine moves a question through a fixed workflow:

    Question -> Retrieve -> Challenge -> Counterargument -> Stress Test
             -> Synthesis -> Certification Mapping -> Memory Storage

Within that workflow it runs one or more *learning loops*. Each loop is a
reusable critical-thinking lens defined by a single driving question and a set
of structured sub-prompts. The loops do not invent facts; they force the system
to interrogate a position from a specific angle and to record what it finds (and
what it could not establish).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class WorkflowStage(StrEnum):
    """The eight ordered stages every learning cycle passes through."""

    QUESTION = "question"
    RETRIEVE = "retrieve"
    CHALLENGE = "challenge"
    COUNTERARGUMENT = "counterargument"
    STRESS_TEST = "stress_test"
    SYNTHESIS = "synthesis"
    CERTIFICATION_MAPPING = "certification_mapping"
    MEMORY_STORAGE = "memory_storage"


WORKFLOW_ORDER: tuple[WorkflowStage, ...] = (
    WorkflowStage.QUESTION,
    WorkflowStage.RETRIEVE,
    WorkflowStage.CHALLENGE,
    WorkflowStage.COUNTERARGUMENT,
    WorkflowStage.STRESS_TEST,
    WorkflowStage.SYNTHESIS,
    WorkflowStage.CERTIFICATION_MAPPING,
    WorkflowStage.MEMORY_STORAGE,
)


@dataclass(frozen=True)
class LearningLoop:
    """A single reusable critical-thinking lens."""

    key: str
    name: str
    driving_question: str
    purpose: str
    prompts: tuple[str, ...]
    # Loops that compare against outside fields (cross-domain) list them here.
    comparison_domains: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> dict[str, object]:
        return {
            "key": self.key,
            "name": self.name,
            "driving_question": self.driving_question,
            "purpose": self.purpose,
            "prompts": list(self.prompts),
            "comparison_domains": list(self.comparison_domains),
        }


# ---------------------------------------------------------------------------
# The five loops (Loop 1–5 of the integration plan)
# ---------------------------------------------------------------------------

FIRST_PRINCIPLES = LearningLoop(
    key="first_principles",
    name="First Principles",
    driving_question="What must be true?",
    purpose=(
        "Decompose the question to the conditions that must hold before any "
        "recommendation is valid — zoning, financing, permitting, labor, demand."
    ),
    prompts=(
        "What are the foundational facts this decision depends on?",
        "Which of those facts are verified, and which are assumptions?",
        "If a load-bearing assumption is wrong, does the recommendation collapse?",
        "What is the simplest version of this that could possibly work?",
    ),
)

COUNTERARGUMENT = LearningLoop(
    key="counterargument",
    name="Counterargument",
    driving_question="Why might this fail?",
    purpose=(
        "Argue the opposite case in good faith to expose fragility — regulatory "
        "delay, liquidity shortfall, onboarding friction, soft demand."
    ),
    prompts=(
        "What is the strongest argument against this plan?",
        "Who loses if this succeeds, and how would they resist it?",
        "What has to go right, in sequence, for this not to fail?",
        "What failure mode would be most expensive to discover late?",
    ),
)

EDGE_CASE = LearningLoop(
    key="edge_case",
    name="Edge Case Discovery",
    driving_question="What breaks under stress?",
    purpose=(
        "Apply a shock and trace the second-order effects across permits, "
        "schedule, insurance, and contractor payments."
    ),
    prompts=(
        "Apply a concrete shock (e.g. a hurricane hits an active coastal job). "
        "What is the first thing that breaks?",
        "How do permits, schedule, insurance, and payments respond to the shock?",
        "Where does a single failure cascade into several?",
        "What buffer or contingency would have absorbed it?",
    ),
)

CROSS_DOMAIN = LearningLoop(
    key="cross_domain",
    name="Cross-Domain Transfer",
    driving_question="What does another industry already know?",
    purpose=(
        "Borrow proven mechanisms from adjacent fields that have solved a "
        "structurally similar problem."
    ),
    prompts=(
        "Which other industry has solved a structurally similar problem?",
        "What mechanism do they use, and what is the analog here?",
        "What constraint makes the transfer imperfect?",
        "What is the smallest experiment to test the borrowed idea?",
    ),
    comparison_domains=(
        "airline operations",
        "logistics networks",
        "manufacturing systems",
        "military planning",
    ),
)

EXECUTIVE_SIMULATION = LearningLoop(
    key="executive_simulation",
    name="Executive Simulation",
    driving_question="What would a CEO actually do?",
    purpose=(
        "Weigh the decision the way an operator must — across risk, capital, "
        "operations, legal exposure, and reputation — before recommending."
    ),
    prompts=(
        "Frame the decision in terms of risk, capital, operations, legal "
        "exposure, and reputation.",
        "What would a disciplined operator do with imperfect information?",
        "What is the reversible first step that preserves optionality?",
        "What would make you change your mind, and how would you detect it?",
    ),
)


LEARNING_LOOPS: dict[str, LearningLoop] = {
    loop.key: loop
    for loop in (
        FIRST_PRINCIPLES,
        COUNTERARGUMENT,
        EDGE_CASE,
        CROSS_DOMAIN,
        EXECUTIVE_SIMULATION,
    )
}


def default_loop_keys() -> list[str]:
    """All five loops, in the canonical order, run by default."""
    return list(LEARNING_LOOPS.keys())
