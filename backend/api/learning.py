"""
Recursive Learning API

Exposes the Recursive Learning Engine: run a learning cycle, run a predefined
priority topic or the first pilot, read stored memories, and read the measured
Recursive Learning Command Center.

Every cycle response carries a Truth-Layer tag (SIMULATED / STAGED — never LIVE)
and an explicit confidence score, so callers can see exactly how much weight an
output may bear before a licensed human reviews it.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.learning import (
    FIRST_PILOT,
    KNOWLEDGE_DOMAINS,
    LEARNING_LOOPS,
    PRIORITY_TOPICS,
    RecursiveLearningEngine,
    RecursiveMemoryStore,
    compute_command_center,
)
from backend.learning.topics import PRIORITY_TOPICS_BY_KEY

router = APIRouter()

# A process-local engine so memories accumulate across requests. (Production
# would hydrate the store from the LearningMemory table on startup.)
_store = RecursiveMemoryStore()
_engine = RecursiveLearningEngine(store=_store)


class LearnRequest(BaseModel):
    topic: str = Field(..., examples=["PermitStream Municipal Expansion"])
    question: str | None = None
    context: str = ""
    loops: list[str] | None = Field(
        default=None,
        description="Loop keys to run; defaults to all five.",
        examples=[["first_principles", "counterargument"]],
    )
    sources: int = Field(default=0, ge=0)
    retrieved_findings: dict[str, list[str]] | None = None
    counterarguments: list[str] | None = None
    connections: list[str] | None = None


@router.post("/learn")
async def learn(req: LearnRequest):
    """Run one recursive learning cycle and store its memory."""
    if not req.topic.strip():
        raise HTTPException(status_code=422, detail="topic must not be empty")
    cycle = _engine.run_cycle(
        topic=req.topic,
        question=req.question,
        context=req.context,
        loop_keys=req.loops,
        sources=req.sources,
        retrieved_findings=req.retrieved_findings,
        observed_counterarguments=req.counterarguments,
        connections=req.connections,
    )
    return cycle.to_dict()


@router.post("/priority-topic/{key}")
async def run_priority_topic(key: str, sources: int = 0):
    """Run one of the predefined NoblePort priority topics."""
    topic = PRIORITY_TOPICS_BY_KEY.get(key)
    if topic is None:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown priority topic {key!r}; "
            f"valid: {list(PRIORITY_TOPICS_BY_KEY)}",
        )
    cycle = _engine.run_cycle(
        topic=topic.title,
        question=f"How does NoblePort win on: {topic.title}? Goals: "
        + "; ".join(topic.goals),
        context=topic.note,
        loop_keys=list(topic.loops),
        sources=sources,
    )
    return cycle.to_dict()


@router.post("/first-pilot")
async def run_first_pilot(sources: int = 0):
    """Run the recommended first live pilot: NoblePort 90-Day Growth Plan."""
    cycle = _engine.run_cycle(
        topic=FIRST_PILOT.title,
        question=(
            "What is the strongest counterargument to NoblePort's 90-day growth "
            "plan, and how is each objection reconciled?"
        ),
        context=f"{FIRST_PILOT.note} Touches: " + "; ".join(FIRST_PILOT.goals),
        loop_keys=list(FIRST_PILOT.loops),
        sources=sources,
    )
    return cycle.to_dict()


@router.get("/command-center")
async def command_center():
    """Recursive Learning Command Center metrics, measured from stored memory."""
    return compute_command_center(_store).to_dict()


@router.get("/memory")
async def memory(due_for_review: bool = False, topic: str | None = None):
    """List stored learning memories."""
    if due_for_review:
        memories = _store.due_for_review()
    elif topic:
        memories = _store.for_topic(topic)
    else:
        memories = _store.all()
    return {
        "count": len(memories),
        "chain_intact": _store.verify_chain(),
        "memories": [m.to_dict() for m in memories],
    }


@router.get("/loops")
async def loops():
    """The five recursive learning loops."""
    return {"loops": [loop.to_dict() for loop in LEARNING_LOOPS.values()]}


@router.get("/knowledge-domains")
async def knowledge_domains():
    """Certification Alignment Engine — knowledge domains, never claimed credentials."""
    return {
        "domains": [d.to_dict() for d in KNOWLEDGE_DOMAINS.values()],
        "note": (
            "Stephanie reasons within these domains but claims no credential; "
            "the named licensed reviewer must certify before any action."
        ),
    }


@router.get("/priority-topics")
async def priority_topics():
    """NoblePort priority topics and the recommended first pilot."""
    return {
        "priority_topics": [t.to_dict() for t in PRIORITY_TOPICS],
        "first_pilot": FIRST_PILOT.to_dict(),
    }
