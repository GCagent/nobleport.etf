"""
Recursive Learning — the engine.

``RecursiveLearningEngine.run_cycle`` walks a question through the eight
workflow stages, runs the requested learning loops, maps the topic onto
knowledge domains, scores its own depth and confidence, assigns a Truth-Layer
tag, and stores an auditable memory.

What it deliberately does *not* do: invent facts. The engine structures the
reasoning and records the evidence the caller supplies (sources, retrieved
context, observed counterarguments). Where evidence is thin, confidence falls
and the gap is named. This is the difference between a learning system and a
confabulating one.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from backend.learning.knowledge_domains import (
    REGULATED_DOMAINS,
    KnowledgeDomain,
    map_knowledge_domains,
)
from backend.learning.loops import (
    LEARNING_LOOPS,
    WORKFLOW_ORDER,
    LearningLoop,
    WorkflowStage,
    default_loop_keys,
)
from backend.learning.memory import RecursiveMemory, RecursiveMemoryStore

# Truth-Layer tags (kept as plain strings to avoid a hard import cycle with the
# governance package; values match backend.governance.truth_layer.TruthTag).
TAG_SIMULATED = "SIMULATED"
TAG_STAGED = "STAGED"

CONFIDENCE_FLOOR = 0.05
CONFIDENCE_CEILING = 0.95  # the engine never claims certainty
DEPTH_TARGET = 8.0


@dataclass
class LoopResult:
    """Outcome of running one learning loop in a cycle."""

    key: str
    name: str
    driving_question: str
    prompts: list[str]
    findings: list[str]
    counterarguments: list[str]
    comparison_domains: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class LearningCycle:
    """The full, auditable record of one recursive learning run."""

    topic: str
    question: str
    stages: list[str]
    loops: list[LoopResult]
    knowledge_domains: list[dict[str, Any]]
    licensed_reviewers_required: list[str]
    connections: list[str]
    knowledge_gaps: list[str]
    sources: int
    counterarguments: int
    depth_score: float
    confidence: float
    tag: str
    tag_rationale: str
    synthesis: str
    memory: dict[str, Any]
    generated_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class RecursiveLearningEngine:
    """Runs recursive learning cycles and persists their memories."""

    def __init__(self, store: RecursiveMemoryStore | None = None) -> None:
        self.store = store if store is not None else RecursiveMemoryStore()

    # -----------------------------------------------------------------------
    # Public entry point
    # -----------------------------------------------------------------------

    def run_cycle(
        self,
        topic: str,
        *,
        question: str | None = None,
        context: str = "",
        loop_keys: list[str] | None = None,
        sources: int = 0,
        retrieved_findings: dict[str, list[str]] | None = None,
        observed_counterarguments: list[str] | None = None,
        connections: list[str] | None = None,
    ) -> LearningCycle:
        """
        Run one recursive learning cycle.

        Parameters mirror the honesty contract:
          * ``sources`` — how many distinct evidence sources informed this run.
          * ``retrieved_findings`` — per-loop findings the caller can supply
            from real retrieval; absent that, the loop records its open prompts.
          * ``observed_counterarguments`` — concrete failure modes already known.
          * ``connections`` — cross-domain links drawn (e.g. "Construction↔Finance").
        """
        if not topic or not topic.strip():
            raise ValueError("A non-empty 'topic' is required to run a learning cycle")
        topic = topic.strip()

        question = question or f"What must NoblePort understand about: {topic}?"
        loop_keys = loop_keys or default_loop_keys()
        retrieved_findings = retrieved_findings or {}
        observed_counterarguments = list(observed_counterarguments or [])
        connections = list(connections or [])

        # Stage: certification mapping (knowledge domains, not credentials).
        domains = map_knowledge_domains(f"{topic} {context} {question}")
        knowledge_gaps = self._identify_gaps(topic, domains, sources)

        # Run the requested loops.
        loop_results = self._run_loops(
            loop_keys, retrieved_findings, observed_counterarguments
        )

        # Aggregate counterarguments across loops + caller-provided ones.
        all_counterarguments = list(observed_counterarguments)
        for result in loop_results:
            all_counterarguments.extend(result.counterarguments)
        counterargument_count = len(all_counterarguments)

        # Derive connections from cross-domain loops + matched domains if none given.
        connections = self._derive_connections(connections, loop_results, domains)

        depth = self._score_depth(
            loops_run=len(loop_results),
            counterarguments=counterargument_count,
            connections=len(connections),
            sources=sources,
        )
        confidence = self._score_confidence(
            loops_run=len(loop_results),
            sources=sources,
            knowledge_gaps=len(knowledge_gaps),
        )

        tag, tag_rationale = self._assign_tag(domains)
        synthesis = self._synthesize(topic, loop_results, domains, knowledge_gaps)

        memory = RecursiveMemory(
            topic=topic,
            depth_score=depth,
            confidence=confidence,
            sources=sources,
            counterarguments=counterargument_count,
            connections=connections,
            knowledge_gaps=knowledge_gaps,
            tag=tag,
            summary=synthesis,
        )
        self.store.add(memory)

        return LearningCycle(
            topic=topic,
            question=question,
            stages=[stage.value for stage in WORKFLOW_ORDER],
            loops=loop_results,
            knowledge_domains=[d.to_dict() for d in domains],
            licensed_reviewers_required=sorted(
                {d.licensed_reviewer_required for d in domains}
            ),
            connections=connections,
            knowledge_gaps=knowledge_gaps,
            sources=sources,
            counterarguments=counterargument_count,
            depth_score=depth,
            confidence=confidence,
            tag=tag,
            tag_rationale=tag_rationale,
            synthesis=synthesis,
            memory=memory.to_dict(),
            generated_at=datetime.now(timezone.utc).isoformat(),
        )

    # -----------------------------------------------------------------------
    # Stages
    # -----------------------------------------------------------------------

    def _run_loops(
        self,
        loop_keys: list[str],
        retrieved_findings: dict[str, list[str]],
        observed_counterarguments: list[str],
    ) -> list[LoopResult]:
        results: list[LoopResult] = []
        for key in loop_keys:
            loop = LEARNING_LOOPS.get(key)
            if loop is None:
                continue
            findings = list(retrieved_findings.get(key, []))
            # The counterargument loop carries any caller-observed failure modes.
            loop_counters: list[str] = []
            if key == "counterargument":
                loop_counters = list(observed_counterarguments)
            results.append(
                LoopResult(
                    key=loop.key,
                    name=loop.name,
                    driving_question=loop.driving_question,
                    prompts=list(loop.prompts),
                    findings=findings,
                    counterarguments=loop_counters,
                    comparison_domains=list(loop.comparison_domains),
                )
            )
        return results

    def _identify_gaps(
        self, topic: str, domains: list[KnowledgeDomain], sources: int
    ) -> list[str]:
        gaps: list[str] = []
        if not domains:
            gaps.append(
                f"Topic '{topic}' did not map to a known knowledge domain — "
                "out of mapped scope; route to a human before relying on output."
            )
        if sources == 0:
            gaps.append(
                "No evidence sources supplied — output is a reasoning scaffold, "
                "not an evidenced conclusion."
            )
        elif sources < 3:
            gaps.append(
                f"Thin evidence base ({sources} source(s)); seek corroboration "
                "before acting."
            )
        return gaps

    def _derive_connections(
        self,
        connections: list[str],
        loop_results: list[LoopResult],
        domains: list[KnowledgeDomain],
    ) -> list[str]:
        if connections:
            return connections
        derived: list[str] = []
        # Cross-domain loop -> connect matched domains to its comparison fields.
        ran_cross_domain = any(r.key == "cross_domain" for r in loop_results)
        domain_names = [d.name for d in domains]
        if ran_cross_domain and domain_names:
            derived.extend(f"{name} ↔ external industry" for name in domain_names)
        # Pairwise links between every matched domain.
        for i, a in enumerate(domain_names):
            for b in domain_names[i + 1 :]:
                derived.append(f"{a} ↔ {b}")
        return derived

    # -----------------------------------------------------------------------
    # Scoring (conservative and explicit)
    # -----------------------------------------------------------------------

    def _score_depth(
        self,
        *,
        loops_run: int,
        counterarguments: int,
        connections: int,
        sources: int,
    ) -> float:
        """Depth 0–10: rewards breadth of critique, evidence, and connection."""
        score = 0.0
        score += min(loops_run, 5) * 1.0          # up to 5.0
        score += min(counterarguments, 4) * 0.5   # up to 2.0
        score += min(connections, 6) * 0.25        # up to 1.5
        score += min(sources, 12) / 12 * 1.5       # up to 1.5
        return round(max(0.0, min(10.0, score)), 1)

    def _score_confidence(
        self, *, loops_run: int, sources: int, knowledge_gaps: int
    ) -> float:
        """Confidence 0.05–0.95: evidence-led, penalized for gaps, never certain."""
        score = 0.30
        score += min(sources, 12) / 12 * 0.40
        score += (min(loops_run, 5) / 5) * 0.20
        score -= knowledge_gaps * 0.05
        return round(max(CONFIDENCE_FLOOR, min(CONFIDENCE_CEILING, score)), 2)

    # -----------------------------------------------------------------------
    # Truth-Layer tag
    # -----------------------------------------------------------------------

    def _assign_tag(self, domains: list[KnowledgeDomain]) -> tuple[str, str]:
        """
        A learning cycle is analysis, never an executed action, so it can never
        be LIVE. If it touches a regulated/credentialed domain it is STAGED
        (held for licensed human review); otherwise SIMULATED.
        """
        regulated = [d.name for d in domains if d.name in REGULATED_DOMAINS]
        if regulated:
            return (
                TAG_STAGED,
                "Touches regulated knowledge domain(s) "
                f"({', '.join(sorted(set(regulated)))}); held as a draft for "
                "licensed human review before any action.",
            )
        return (
            TAG_SIMULATED,
            "Scenario-planning analysis with no real-world effect; safe to "
            "review and iterate.",
        )

    # -----------------------------------------------------------------------
    # Synthesis
    # -----------------------------------------------------------------------

    def _synthesize(
        self,
        topic: str,
        loop_results: list[LoopResult],
        domains: list[KnowledgeDomain],
        knowledge_gaps: list[str],
    ) -> str:
        lenses = ", ".join(r.name for r in loop_results) or "no loops"
        domain_names = ", ".join(d.name for d in domains) or "unmapped scope"
        lines = [
            f"Topic '{topic}' examined through {len(loop_results)} loop(s): {lenses}.",
            f"Mapped knowledge domains: {domain_names}.",
        ]
        if knowledge_gaps:
            lines.append(f"Open gaps: {len(knowledge_gaps)} flagged for follow-up.")
        lines.append(
            "Output is a structured executive analysis — not a credentialed "
            "opinion — and is tagged accordingly for the governance gate."
        )
        return " ".join(lines)
