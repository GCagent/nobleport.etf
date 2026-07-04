"""
NoblePort OS — Recursive Learning Engine

Turns Stephanie.ai from a retrieval assistant into a *recursive executive
operator*: a system that, for a given question, runs a structured chain of
critical-thinking loops (first principles, counterargument, edge case,
cross-domain transfer, executive simulation), maps the result onto knowledge
domains it may legitimately reason about, scores its own depth and confidence,
and stores an auditable memory it can revisit and improve on.

Design guarantees (these are the point — they keep the system defensible):

  * No fabricated authority. Outputs are tagged with the same Truth-Layer
    protocol the governance gate uses, and default to SIMULATED / STAGED —
    never LIVE. A learning cycle is analysis, not an executed action.
  * No claimed credentials. The certification-alignment step maps a topic onto
    *knowledge domains* and names the licensed reviewer required, mirroring the
    governance credential register (can_claim is always False).
  * Auditable memory. Every stored memory is hash-chained to the previous one,
    carries source counts, counterarguments, and an explicit confidence score,
    and schedules its own next review.
  * Honest uncertainty. Confidence is computed conservatively from evidence and
    is clamped below certainty; knowledge gaps are surfaced, not hidden.

Public surface:
    LearningLoop, LEARNING_LOOPS, WorkflowStage,
    KnowledgeDomain, KNOWLEDGE_DOMAINS, map_knowledge_domains,
    RecursiveMemory, RecursiveMemoryStore,
    RecursiveLearningEngine, LearningCycle,
    CommandCenterMetrics, compute_command_center,
    PRIORITY_TOPICS, FIRST_PILOT, PriorityTopic
"""

from backend.learning.loops import (
    LEARNING_LOOPS,
    LearningLoop,
    WorkflowStage,
    default_loop_keys,
)
from backend.learning.knowledge_domains import (
    KNOWLEDGE_DOMAINS,
    KnowledgeDomain,
    map_knowledge_domains,
)
from backend.learning.memory import RecursiveMemory, RecursiveMemoryStore
from backend.learning.engine import LearningCycle, RecursiveLearningEngine
from backend.learning.metrics import CommandCenterMetrics, compute_command_center
from backend.learning.topics import FIRST_PILOT, PRIORITY_TOPICS, PriorityTopic

__all__ = [
    "LearningLoop",
    "LEARNING_LOOPS",
    "WorkflowStage",
    "default_loop_keys",
    "KnowledgeDomain",
    "KNOWLEDGE_DOMAINS",
    "map_knowledge_domains",
    "RecursiveMemory",
    "RecursiveMemoryStore",
    "RecursiveLearningEngine",
    "LearningCycle",
    "CommandCenterMetrics",
    "compute_command_center",
    "PRIORITY_TOPICS",
    "FIRST_PILOT",
    "PriorityTopic",
]
