"""
Tests for the Recursive Learning Engine.

These assert the system's honesty guarantees: cycles run all eight workflow
stages, confidence never claims certainty and rises with evidence, regulated
topics stage for human review rather than going LIVE, knowledge gaps are
surfaced, the memory chain is tamper-evident, and the Command Center metrics
match the memories actually stored.
"""

from __future__ import annotations

import pytest

from backend.learning import (
    LEARNING_LOOPS,
    RecursiveLearningEngine,
    RecursiveMemoryStore,
    compute_command_center,
    map_knowledge_domains,
)
from backend.learning.engine import CONFIDENCE_CEILING
from backend.learning.loops import WORKFLOW_ORDER


def make_engine() -> RecursiveLearningEngine:
    return RecursiveLearningEngine(store=RecursiveMemoryStore())


def test_cycle_runs_all_workflow_stages():
    engine = make_engine()
    cycle = engine.run_cycle("PermitStream Municipal Expansion", sources=4)
    assert cycle.stages == [s.value for s in WORKFLOW_ORDER]
    assert len(cycle.stages) == 8


def test_default_runs_all_five_loops():
    engine = make_engine()
    cycle = engine.run_cycle("Coastal flood resilience", sources=3)
    assert len(cycle.loops) == len(LEARNING_LOOPS) == 5


def test_confidence_never_reaches_certainty():
    engine = make_engine()
    # Maximal evidence still must not produce certainty.
    cycle = engine.run_cycle("Construction scheduling", sources=999)
    assert cycle.confidence <= CONFIDENCE_CEILING
    assert cycle.confidence < 1.0


def test_confidence_rises_with_evidence():
    engine = make_engine()
    low = engine.run_cycle("Permit cycle time", sources=0)
    high = engine.run_cycle("Permit cycle time", sources=12)
    assert high.confidence > low.confidence


def test_no_sources_flags_a_knowledge_gap():
    engine = make_engine()
    cycle = engine.run_cycle("Permit automation", sources=0)
    assert any("No evidence sources" in gap for gap in cycle.knowledge_gaps)


def test_unmapped_topic_flags_out_of_scope():
    engine = make_engine()
    cycle = engine.run_cycle("the migratory patterns of arctic terns", sources=5)
    assert cycle.knowledge_domains == []
    assert any("did not map" in gap for gap in cycle.knowledge_gaps)


def test_regulated_topic_is_staged_not_live():
    engine = make_engine()
    cycle = engine.run_cycle(
        "NBPT stablecoin treasury and audit compliance", sources=5
    )
    assert cycle.tag == "STAGED"
    assert cycle.tag != "LIVE"
    assert "Finance" in [d["name"] for d in cycle.knowledge_domains]


def test_non_regulated_topic_is_simulated():
    engine = make_engine()
    # A topic that maps to no regulated domain stays SIMULATED.
    cycle = engine.run_cycle("arctic tern migration", sources=2)
    assert cycle.tag == "SIMULATED"


def test_knowledge_domains_never_claim_credentials():
    for domain in map_knowledge_domains("construction finance governance real estate"):
        payload = domain.to_dict()
        assert payload["can_claim_credential"] is False
        assert payload["licensed_reviewer_required"]


def test_memory_chain_is_tamper_evident():
    engine = make_engine()
    engine.run_cycle("Topic A", sources=2)
    engine.run_cycle("Topic B", sources=4)
    store = engine.store
    assert store.verify_chain() is True
    # Tamper with a stored score; the chain must detect it.
    store.all()[0].depth_score = 99.0
    assert store.verify_chain() is False


def test_next_review_scheduled_sooner_for_low_confidence():
    engine = make_engine()
    low = engine.run_cycle("Sparse topic", sources=0)
    high = engine.run_cycle("Well sourced municipal permit data", sources=12)
    assert low.memory["next_review"] < high.memory["next_review"]


def test_command_center_matches_stored_memories():
    engine = make_engine()
    engine.run_cycle("Permit expansion", sources=6)
    engine.run_cycle("Payment node", sources=3)
    metrics = compute_command_center(engine.store)
    assert metrics.cycles_recorded == 2
    assert metrics.learning_depth_target == 8.0
    assert 0.0 <= metrics.confidence_average <= CONFIDENCE_CEILING
    assert metrics.chain_intact is True


def test_counterargument_loop_carries_observed_failures():
    engine = make_engine()
    cycle = engine.run_cycle(
        "NBPT Launch",
        loop_keys=["counterargument"],
        sources=3,
        observed_counterarguments=["regulatory delay", "liquidity shortfall"],
    )
    assert cycle.counterarguments >= 2
    counter_loop = next(l for l in cycle.loops if l.key == "counterargument")
    assert "regulatory delay" in counter_loop.counterarguments


def test_empty_topic_rejected():
    engine = make_engine()
    with pytest.raises(ValueError):
        engine.run_cycle("   ".strip() or "")
