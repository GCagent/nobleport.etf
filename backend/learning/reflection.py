"""
Reflection Engine — verified experience -> better operational knowledge.

The recursive-learning engine (``backend/learning/engine.py``) reasons over a
*question*. This module closes the other half of the loop the architecture
describes: it reflects over a *completed project's evidence* and converts what
actually happened into **proposed operational improvements** — better SOPs,
pricing, estimating, risk models, proposal templates, and inspection checklists.

The closed loop:

    Observe -> Remember -> Reason -> Reflect -> Improve -> Test -> Validate
            -> Teach -> (repeat)

Operationally, per project:

    1. Finish a project.
    2. Extract the evidence (photos, contracts, permits, proposals, invoices,
       voice, inspections, payments).
    3. Compare it to historical patterns.
    4. Identify what changed.
    5. Draft updated procedures.
    6. PRESENT important changes for human approval.   <-- the HITL gate
    7. Apply the APPROVED improvements on the next project.

Two invariants make this safe rather than a self-rewriting black box:

  * **Evidence-gated.** Only *verified* evidence drives an improvement. Unverified
    artifacts are surfaced as knowledge gaps, never used as a basis for change.
    (Mirrors the evidence-gated verification framework.)
  * **Human-in-the-loop.** The engine *proposes*; it never *applies*. Every
    improvement is STAGED and starts life as ``PROPOSED``. It cannot be applied
    until a named human approves it. Meaningful operational change is a human
    decision, logged — exactly as the governance framework requires.

This module reuses, rather than re-implements, the learning primitives: the
hash-chained ``RecursiveMemoryStore`` for the auditable episodic record, the
Truth-Layer tags for governance, and the knowledge-domain map for naming the
licensed reviewer a regulated change requires.
"""

from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum, StrEnum

from backend.learning.knowledge_domains import (
    REGULATED_DOMAINS,
    KnowledgeDomain,
    map_knowledge_domains,
)
from backend.learning.memory import RecursiveMemory, RecursiveMemoryStore

# Truth-Layer tags as plain strings (the learning package keeps these decoupled
# from the governance import to avoid a cycle; values match TruthTag).
TAG_STAGED = "STAGED"


# ===========================================================================
# Memory layers — how a learning is classified
# ===========================================================================


class MemoryLayer(StrEnum):
    """The seven memory layers the architecture describes."""

    EPISODIC = "episodic"          # Individual jobs, conversations, inspections, proposals
    SEMANTIC = "semantic"          # Construction knowledge, code, municipal processes, estimating
    PROCEDURAL = "procedural"      # SOPs, workflows, checklists, payment schedules, proposals
    FINANCIAL = "financial"        # Margins, job costing, vendor pricing, cash flow, revenue
    GOVERNANCE = "governance"      # HITL approvals, audit history, policy changes, evidence ledger
    REFLECTION = "reflection"      # Lessons learned, recurring mistakes, successful approaches
    STRATEGY = "strategy"          # Long-term goals, product roadmap, market opportunities


MEMORY_LAYER_PURPOSE: dict[MemoryLayer, str] = {
    MemoryLayer.EPISODIC: "Individual jobs, conversations, inspections, proposals.",
    MemoryLayer.SEMANTIC: "Construction knowledge, code interpretations, municipal processes, estimating patterns.",
    MemoryLayer.PROCEDURAL: "SOPs, workflows, checklists, payment schedules, proposal generation.",
    MemoryLayer.FINANCIAL: "Margins, job costing, vendor pricing, cash flow, revenue patterns.",
    MemoryLayer.GOVERNANCE: "HITL approvals, audit history, policy changes, evidence ledger.",
    MemoryLayer.REFLECTION: "Lessons learned, recurring mistakes, successful approaches.",
    MemoryLayer.STRATEGY: "Long-term business goals, product roadmap, market opportunities.",
}


# ===========================================================================
# The closed loop
# ===========================================================================


class ReflectionStage(StrEnum):
    OBSERVE = "observe"
    REMEMBER = "remember"
    REASON = "reason"
    REFLECT = "reflect"
    IMPROVE = "improve"
    TEST = "test"
    VALIDATE = "validate"
    TEACH = "teach"


# The full loop, in order. It is a cycle: TEACH feeds the next project's OBSERVE.
REFLECTION_LOOP: tuple[ReflectionStage, ...] = (
    ReflectionStage.OBSERVE,
    ReflectionStage.REMEMBER,
    ReflectionStage.REASON,
    ReflectionStage.REFLECT,
    ReflectionStage.IMPROVE,
    ReflectionStage.TEST,
    ReflectionStage.VALIDATE,
    ReflectionStage.TEACH,
)


# ===========================================================================
# Evidence
# ===========================================================================


class EvidenceType(StrEnum):
    """The project artifacts the engine ingests (per the architecture diagram)."""

    PHOTO = "photo"
    CONTRACT = "contract"
    PERMIT = "permit"
    PROPOSAL = "proposal"
    INVOICE = "invoice"
    VOICE = "voice"
    INSPECTION = "inspection"
    PAYMENT = "payment"


@dataclass(frozen=True)
class EvidenceItem:
    """One piece of project evidence. ``verified`` gates whether it can drive change."""

    type: EvidenceType
    summary: str
    verified: bool = False


# ===========================================================================
# Improvement targets — what an improvement may update
# ===========================================================================


class ImprovementTarget(StrEnum):
    """The operational artifacts an improvement can propose changing."""

    SOP = "sop"
    PRICING = "pricing"
    ESTIMATING = "estimating"
    RISK_MODEL = "risk_model"
    PROPOSAL_TEMPLATE = "proposal_template"
    INSPECTION_CHECKLIST = "inspection_checklist"


@dataclass(frozen=True)
class TargetSpec:
    """Where an improvement target lives and who must review a change to it."""

    target: ImprovementTarget
    layer: MemoryLayer
    domain_hint: str  # routed through map_knowledge_domains to find the reviewer


TARGET_SPECS: dict[ImprovementTarget, TargetSpec] = {
    ImprovementTarget.SOP: TargetSpec(
        ImprovementTarget.SOP, MemoryLayer.PROCEDURAL, "construction schedule crew"),
    ImprovementTarget.PRICING: TargetSpec(
        ImprovementTarget.PRICING, MemoryLayer.FINANCIAL, "pricing revenue margin payment"),
    ImprovementTarget.ESTIMATING: TargetSpec(
        ImprovementTarget.ESTIMATING, MemoryLayer.FINANCIAL, "estimate cost construction"),
    ImprovementTarget.RISK_MODEL: TargetSpec(
        ImprovementTarget.RISK_MODEL, MemoryLayer.GOVERNANCE, "risk control governance audit"),
    ImprovementTarget.PROPOSAL_TEMPLATE: TargetSpec(
        ImprovementTarget.PROPOSAL_TEMPLATE, MemoryLayer.PROCEDURAL, "proposal construction contractor"),
    ImprovementTarget.INSPECTION_CHECKLIST: TargetSpec(
        ImprovementTarget.INSPECTION_CHECKLIST, MemoryLayer.PROCEDURAL, "inspection permit construction"),
}


# ===========================================================================
# Reflection signals (caller-supplied observations) and proposed improvements
# ===========================================================================


@dataclass(frozen=True)
class ReflectionSignal:
    """
    One observation from a completed project that *might* warrant a change.

    The engine does not fabricate signals — like the recursive-learning engine,
    it structures and governs observations the caller supplies from real project
    data. ``changed`` says whether this diverges from the historical norm;
    ``supporting_evidence`` lists the evidence types that back it.
    """

    target: ImprovementTarget
    observation: str
    supporting_evidence: tuple[EvidenceType, ...]
    changed: bool = True


class ImprovementStatus(str, Enum):
    PROPOSED = "proposed"    # default — drafted, awaiting human review
    APPROVED = "approved"    # a named human signed off
    REJECTED = "rejected"    # a named human declined
    APPLIED = "applied"      # approved AND rolled into the standards


@dataclass(frozen=True)
class ProposedImprovement:
    """
    A drafted operational change. STAGED and human-gated by construction: it can
    never be applied until it is APPROVED by a named human.
    """

    target: ImprovementTarget
    layer: MemoryLayer
    description: str
    rationale: str
    supporting_evidence: tuple[EvidenceType, ...]
    licensed_reviewer_required: str | None
    tag: str = TAG_STAGED                       # always STAGED — never LIVE
    status: ImprovementStatus = ImprovementStatus.PROPOSED
    supersedes: str | None = None               # prior knowledge this updates, if any
    approved_by: str | None = None

    @property
    def requires_human_approval(self) -> bool:
        return True  # always — meaningful operational change is a human decision

    @property
    def regulated(self) -> bool:
        return self.licensed_reviewer_required is not None


@dataclass(frozen=True)
class ReflectionResult:
    """The auditable output of reflecting on one completed project."""

    project_id: str
    stages: tuple[str, ...]
    classified: dict[str, list[str]]            # memory layer -> learning summaries
    proposed_improvements: tuple[ProposedImprovement, ...]
    knowledge_gaps: tuple[str, ...]
    memory: dict[str, object]                   # the episodic memory stored
    generated_at: str

    @property
    def applied_anything(self) -> bool:
        """Always False: reflection proposes; it never applies."""
        return any(i.status is ImprovementStatus.APPLIED
                   for i in self.proposed_improvements)


# ===========================================================================
# Engine
# ===========================================================================


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ReflectionEngine:
    """
    Reflects over completed-project evidence and proposes HITL-gated improvements.

    It shares the hash-chained ``RecursiveMemoryStore`` with the recursive
    learning engine so the episodic record of every reflection is tamper-evident
    and revisitable, and so "compare against every previous project" is a real
    lookup, not a metaphor.
    """

    def __init__(self, store: RecursiveMemoryStore | None = None) -> None:
        self.store = store if store is not None else RecursiveMemoryStore()

    # -- the loop ------------------------------------------------------------

    def reflect(
        self,
        project_id: str,
        *,
        evidence: list[EvidenceItem],
        signals: list[ReflectionSignal] | None = None,
        outcome_summary: str = "",
    ) -> ReflectionResult:
        """
        Run one reflection cycle over a completed project.

        Only *verified* evidence can support an improvement. A signal whose
        supporting evidence is missing or unverified is downgraded to a knowledge
        gap — it is recorded, but it does not become a proposed change.
        """
        if not project_id or not project_id.strip():
            raise ValueError("A non-empty 'project_id' is required to reflect")
        project_id = project_id.strip()
        signals = list(signals or [])

        verified_types = {e.type for e in evidence if e.verified}
        unverified_types = {e.type for e in evidence if not e.verified}

        classified = self._classify(evidence, signals, outcome_summary)
        improvements, gaps = self._draft_improvements(signals, verified_types)

        # Honesty: name the unverified artifacts we deliberately did NOT act on.
        for etype in sorted(unverified_types - verified_types, key=lambda t: t.value):
            gaps.append(
                f"Unverified {etype.value} evidence present — excluded from any "
                "improvement until verified."
            )
        if not evidence:
            gaps.append("No project evidence supplied — nothing to learn from this cycle.")

        memory = self._store_episode(project_id, improvements, gaps, outcome_summary)
        # Record one per-target memory so a later cycle's _prior_knowledge can
        # find and supersede this project's learning for the same target.
        self._record_improvements(project_id, improvements)

        return ReflectionResult(
            project_id=project_id,
            stages=tuple(s.value for s in REFLECTION_LOOP),
            classified={layer: summaries for layer, summaries in classified.items()},
            proposed_improvements=tuple(improvements),
            knowledge_gaps=tuple(gaps),
            memory=memory.to_dict(),
            generated_at=_utcnow_iso(),
        )

    # -- classify (Reason/Reflect) ------------------------------------------

    def _classify(
        self,
        evidence: list[EvidenceItem],
        signals: list[ReflectionSignal],
        outcome_summary: str,
    ) -> dict[str, list[str]]:
        """Sort what happened into the seven memory layers."""
        layers: dict[str, list[str]] = {layer.value: [] for layer in MemoryLayer}

        # Every project IS an episode.
        for item in evidence:
            layers[MemoryLayer.EPISODIC.value].append(
                f"{item.type.value}: {item.summary}"
                + ("" if item.verified else " (unverified)")
            )
        # Each signal lands in the layer its target lives in, plus a reflection note.
        for sig in signals:
            spec = TARGET_SPECS[sig.target]
            layers[spec.layer.value].append(f"{sig.target.value}: {sig.observation}")
            layers[MemoryLayer.REFLECTION.value].append(
                f"{'change' if sig.changed else 'confirmation'} on {sig.target.value}: "
                f"{sig.observation}"
            )
        if outcome_summary:
            layers[MemoryLayer.REFLECTION.value].append(outcome_summary)
        return layers

    # -- draft improvements (Improve) ---------------------------------------

    def _draft_improvements(
        self,
        signals: list[ReflectionSignal],
        verified_types: set[EvidenceType],
    ) -> tuple[list[ProposedImprovement], list[str]]:
        improvements: list[ProposedImprovement] = []
        gaps: list[str] = []

        for sig in signals:
            if not sig.changed:
                # A confirmation of existing practice — learned, but no change drafted.
                continue

            backing = tuple(e for e in sig.supporting_evidence if e in verified_types)
            if not backing:
                gaps.append(
                    f"Signal on {sig.target.value} ('{sig.observation}') lacks verified "
                    "evidence — recorded as a lesson but NOT proposed as a change."
                )
                continue

            spec = TARGET_SPECS[sig.target]
            reviewer = self._licensed_reviewer(spec)
            supersedes = self._prior_knowledge(sig.target)

            improvements.append(ProposedImprovement(
                target=sig.target,
                layer=spec.layer,
                description=f"Update {sig.target.value.replace('_', ' ')}: {sig.observation}",
                rationale=(
                    f"Backed by verified {', '.join(e.value for e in backing)} evidence "
                    f"from this project."
                ),
                supporting_evidence=backing,
                licensed_reviewer_required=reviewer,
                supersedes=supersedes,
            ))
        return improvements, gaps

    def _licensed_reviewer(self, spec: TargetSpec) -> str | None:
        """Name the licensed reviewer if the target touches a regulated domain."""
        domains: list[KnowledgeDomain] = map_knowledge_domains(spec.domain_hint)
        regulated = [d for d in domains if d.name in REGULATED_DOMAINS]
        if not regulated:
            return None
        # Deterministic: first regulated domain by name.
        return sorted(regulated, key=lambda d: d.name)[0].licensed_reviewer_required

    def _prior_knowledge(self, target: ImprovementTarget) -> str | None:
        """Find a prior reflection memory for this target to supersede."""
        topic = self._memory_topic(target)
        prior = self.store.for_topic(topic)
        return prior[-1].record_hash if prior else None

    # -- store the episode (Remember) ---------------------------------------

    def _store_episode(
        self,
        project_id: str,
        improvements: list[ProposedImprovement],
        gaps: list[str],
        outcome_summary: str,
    ) -> RecursiveMemory:
        summary = (
            f"Reflection on project {project_id}: "
            f"{len(improvements)} improvement(s) proposed (STAGED, awaiting approval), "
            f"{len(gaps)} knowledge gap(s)."
        )
        if outcome_summary:
            summary += f" Outcome: {outcome_summary}"
        memory = RecursiveMemory(
            topic=f"reflection:{project_id}",
            depth_score=0.0,
            confidence=0.0,
            sources=len({e for i in improvements for e in i.supporting_evidence}),
            counterarguments=0,
            connections=[i.target.value for i in improvements],
            knowledge_gaps=list(gaps),
            tag=TAG_STAGED,
            summary=summary,
        )
        return self.store.add(memory)

    def _record_improvements(
        self, project_id: str, improvements: list[ProposedImprovement]
    ) -> None:
        """
        Append one per-target memory for each proposed improvement so the target's
        learning history is a real, chain-linked lookup. These are STAGED records
        of a *proposal* — they do not mean the change was applied.
        """
        for imp in improvements:
            self.store.add(RecursiveMemory(
                topic=self._memory_topic(imp.target),
                depth_score=0.0,
                confidence=0.0,
                sources=len(imp.supporting_evidence),
                counterarguments=0,
                connections=[project_id],
                knowledge_gaps=[],
                tag=TAG_STAGED,
                summary=f"[{imp.status.value}] {imp.description} — {imp.rationale}",
            ))

    @staticmethod
    def _memory_topic(target: ImprovementTarget) -> str:
        return f"improvement:{target.value}"


# ===========================================================================
# Human-in-the-loop gate — proposes here, applies only after approval
# ===========================================================================


def approve_improvement(improvement: ProposedImprovement, approver: str) -> ProposedImprovement:
    """Record a named human's approval. Returns the APPROVED improvement."""
    if not approver or not approver.strip():
        raise ValueError("approval requires a named human approver")
    if improvement.status is ImprovementStatus.REJECTED:
        raise ValueError("a rejected improvement cannot be approved")
    return dataclasses.replace(
        improvement, status=ImprovementStatus.APPROVED, approved_by=approver.strip()
    )


def reject_improvement(improvement: ProposedImprovement, approver: str) -> ProposedImprovement:
    """Record a named human's rejection."""
    if not approver or not approver.strip():
        raise ValueError("rejection requires a named human reviewer")
    return dataclasses.replace(
        improvement, status=ImprovementStatus.REJECTED, approved_by=approver.strip()
    )


def apply_improvement(improvement: ProposedImprovement) -> ProposedImprovement:
    """
    Roll an APPROVED improvement into the standards. This is the ONLY path to
    APPLIED, and it fails closed: an unapproved improvement cannot be applied.
    This is the executable form of the HITL guarantee.
    """
    if improvement.status is not ImprovementStatus.APPROVED:
        raise PermissionError(
            "Improvement is not approved by a human; refusing to apply. "
            "Reflection proposes — only an approved change may be applied."
        )
    return dataclasses.replace(improvement, status=ImprovementStatus.APPLIED)
