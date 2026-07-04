"""
NoblePort OS — RecursiveLearningAgent

The learning node of the mesh. Where the other agents *operate* the revenue
spine, this agent *reflects on it*: it takes a question, runs it through the
recursive learning workflow (Question -> Retrieve -> Challenge -> Counterargument
-> Stress Test -> Synthesis -> Certification Mapping -> Memory Storage), and
stores an auditable memory that future cycles can build on.

It is the executable form of the "Recursive Executive Operator" upgrade: the
difference between an assistant that answers and a system that learns patterns,
critiques assumptions, identifies risk, and improves its next recommendation —
without manufacturing authority or certainty. Every output is Truth-Layer tagged
(SIMULATED / STAGED, never LIVE) and routed through the same governance posture
as the rest of the OS.
"""

from __future__ import annotations

import logging
from typing import Any

from backend.agents.base import AgentFamily, BaseAgent
from backend.learning import (
    LEARNING_LOOPS,
    KNOWLEDGE_DOMAINS,
    PRIORITY_TOPICS,
    FIRST_PILOT,
    RecursiveLearningEngine,
    RecursiveMemoryStore,
    compute_command_center,
)
from backend.learning.topics import PRIORITY_TOPICS_BY_KEY

logger = logging.getLogger(__name__)


class RecursiveLearningAgent(BaseAgent):
    """
    RecursiveLearningAgent — Stephanie's reflective learning loop.

    Roles:
      - Runs recursive learning cycles over executive questions
      - Maintains an auditable, hash-chained memory of what was learned
      - Surfaces the Recursive Learning Command Center metrics
      - Maps every topic onto knowledge domains (never claimed credentials)
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="RecursiveLearningAgent",
            family=AgentFamily.RECURSIVE_LEARNING,
            role=(
                "Recursive executive operator: learns patterns, critiques "
                "assumptions, identifies risk, and improves recommendations"
            ),
            agent_id=agent_id or "recursive-learning-primary",
        )
        # One shared store per agent instance so memories accumulate across runs.
        self._store = RecursiveMemoryStore()
        self._engine = RecursiveLearningEngine(store=self._store)

    # -----------------------------------------------------------------------
    # Task router
    # -----------------------------------------------------------------------

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "run_learning_cycle" | "recursive_learn":
                return await self.run_learning_cycle(payload)
            case "run_priority_topic":
                return await self.run_priority_topic(payload)
            case "run_first_pilot":
                return await self.run_first_pilot(payload)
            case "get_command_center":
                return await self.get_command_center()
            case "get_memory":
                return await self.get_memory(payload)
            case "list_loops":
                return self.list_loops()
            case "list_knowledge_domains":
                return self.list_knowledge_domains()
            case "list_priority_topics":
                return self.list_priority_topics()
            case _:
                raise ValueError(
                    f"Unknown RecursiveLearning task type: {task_type}"
                )

    # -----------------------------------------------------------------------
    # Cycles
    # -----------------------------------------------------------------------

    async def run_learning_cycle(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Run a recursive learning cycle from a free-form payload."""
        topic = payload.get("topic", "").strip()
        if not topic:
            raise ValueError("A 'topic' is required to run a learning cycle")

        cycle = self._engine.run_cycle(
            topic=topic,
            question=payload.get("question"),
            context=payload.get("context", ""),
            loop_keys=payload.get("loops"),
            sources=int(payload.get("sources", 0) or 0),
            retrieved_findings=payload.get("retrieved_findings"),
            observed_counterarguments=payload.get("counterarguments"),
            connections=payload.get("connections"),
        )
        logger.info(
            "Recursive learning cycle on %r -> depth=%.1f confidence=%.2f tag=%s",
            topic,
            cycle.depth_score,
            cycle.confidence,
            cycle.tag,
        )
        return cycle.to_dict()

    async def run_priority_topic(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Run one of the predefined NoblePort priority topics by key."""
        key = payload.get("key", "")
        topic = PRIORITY_TOPICS_BY_KEY.get(key)
        if topic is None:
            valid = ", ".join(PRIORITY_TOPICS_BY_KEY)
            raise ValueError(f"Unknown priority topic {key!r}; valid keys: {valid}")
        return await self.run_learning_cycle({
            "topic": topic.title,
            "question": f"How does NoblePort win on: {topic.title}? Goals: "
            + "; ".join(topic.goals),
            "context": topic.note,
            "loops": list(topic.loops),
            "sources": int(payload.get("sources", 0) or 0),
            "counterarguments": payload.get("counterarguments"),
        })

    async def run_first_pilot(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Run the recommended first live pilot: the NoblePort 90-Day Growth Plan."""
        return await self.run_learning_cycle({
            "topic": FIRST_PILOT.title,
            "question": (
                "What is the strongest counterargument to NoblePort's 90-day "
                "growth plan, and how is each objection reconciled?"
            ),
            "context": f"{FIRST_PILOT.note} Touches: " + "; ".join(FIRST_PILOT.goals),
            "loops": list(FIRST_PILOT.loops),
            "sources": int(payload.get("sources", 0) or 0),
            "counterarguments": payload.get("counterarguments"),
        })

    # -----------------------------------------------------------------------
    # Reads
    # -----------------------------------------------------------------------

    async def get_command_center(self) -> dict[str, Any]:
        """Recursive Learning Command Center metrics, measured from memory."""
        return compute_command_center(self._store).to_dict()

    async def get_memory(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return stored memories, optionally filtered to those due for review."""
        if payload.get("due_for_review"):
            memories = self._store.due_for_review()
        elif topic := payload.get("topic"):
            memories = self._store.for_topic(topic)
        else:
            memories = self._store.all()
        return {
            "count": len(memories),
            "chain_intact": self._store.verify_chain(),
            "memories": [m.to_dict() for m in memories],
        }

    def list_loops(self) -> dict[str, Any]:
        return {"loops": [loop.to_dict() for loop in LEARNING_LOOPS.values()]}

    def list_knowledge_domains(self) -> dict[str, Any]:
        return {
            "domains": [d.to_dict() for d in KNOWLEDGE_DOMAINS.values()],
            "note": (
                "Knowledge domains map topics onto bodies of knowledge Stephanie "
                "may reason about. She claims no credential; named reviewers must "
                "certify before action."
            ),
        }

    def list_priority_topics(self) -> dict[str, Any]:
        return {
            "priority_topics": [t.to_dict() for t in PRIORITY_TOPICS],
            "first_pilot": FIRST_PILOT.to_dict(),
        }
