"""
Tests for PermitStream.ai — permit / zoning / compliance intelligence.

These exercise the agent's deterministic, DB-free surface: the AHJ profile
catalog, the agent's identity, and the pure zoning-compliance checklist logic.
Database-backed methods (risk assessment, inspection tracking) are out of scope
here — they require a live session — but the routing and classification logic
that does not touch the DB is asserted end to end.
"""

from __future__ import annotations

import asyncio

from backend.agents.base import AgentFamily
from backend.agents.permit_stream import (
    _AHJ_PROFILES,
    _DEFAULT_AHJ,
    PermitStreamAgent,
)

_TRADES = {"building", "electrical", "plumbing", "mechanical"}


def test_ahj_profiles_have_consistent_shape():
    """Every AHJ profile (and the default) carries the same review-time keys."""
    for name, profile in {**_AHJ_PROFILES, "_default": _DEFAULT_AHJ}.items():
        assert "median_review_days" in profile, f"{name} missing median_review_days"
        assert _TRADES <= set(profile["median_review_days"]), f"{name} missing a trade"
        assert profile["p90_factor"] >= 1.0, f"{name} has implausible p90_factor"
        assert isinstance(profile["common_corrections"], list)
        assert profile["common_corrections"], f"{name} has no common_corrections"


def test_known_ahjs_present():
    assert {"newburyport", "newbury", "amesbury", "salisbury"} <= set(_AHJ_PROFILES)


def test_agent_identity():
    agent = PermitStreamAgent()
    assert agent.name == "PermitStream.ai"
    assert agent.family is AgentFamily.PERMIT_STREAM
    assert agent.id == "permitstream-primary"


def test_zoning_maps_project_type_to_use():
    agent = PermitStreamAgent()
    res = asyncio.run(agent.check_zoning_compliance("parcel-1", "residential_renovation"))
    assert res["proposed_use"] == "residential"
    assert res["parcel_id"] == "parcel-1"

    com = asyncio.run(agent.check_zoning_compliance("parcel-2", "commercial_new"))
    assert com["proposed_use"] == "commercial"


def test_zoning_checklist_statuses_are_valid():
    agent = PermitStreamAgent()
    res = asyncio.run(agent.check_zoning_compliance("p", "residential_new"))
    allowed = {"pass", "fail", "review_needed"}
    assert all(c["status"] in allowed for c in res["checks"])
    # No hard failures in the default checklist -> overall is review_needed.
    assert res["overall_status"] == "review_needed"


def test_zoning_mixed_use_flags_density_review():
    agent = PermitStreamAgent()
    res = asyncio.run(agent.check_zoning_compliance("p", "mixed_use"))
    assert res["proposed_use"] == "mixed"
    density = next(c for c in res["checks"] if c["check"] == "density")
    assert density["status"] == "review_needed"
