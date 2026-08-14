"""
Tests for the Command Board ledger (backend/models/command_board.py).

These prove the backend mirror of the dashboard's five Airtable ledgers:
  - the Build Projects roll-ups (Revised Contract Value, AR Balance, Balance
    Remaining, Forecast Gross Profit / Margin %) are derived from inputs and
    cannot drift,
  - the bid weighted-value KPI input is correct, and
  - every ledger row carries an evidence label and the five tables actually
    create and persist against a real (in-memory) database.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import backend.models  # noqa: F401 - register all models on Base.metadata
from backend.config.database import Base
from backend.models.command_board import (
    BidOpportunity,
    BidStatus,
    BuildProject,
    BuildStatus,
    ChangeOrderAWO,
    EvidenceLabel,
    JobCategory,
    ProjectEvent,
    ProjectFinancial,
)


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


def test_build_project_rollups():
    b = BuildProject(
        name="95 Clipper Way",
        original_contract_value=99_750.0,
        approved_change_orders=10_000.0,
        total_billed=60_000.0,
        total_collected=45_000.0,
        forecast_cost=82_000.0,
    )
    assert b.revised_contract_value == 109_750.0
    assert b.ar_balance == 15_000.0          # billed - collected
    assert b.balance_remaining == 49_750.0   # revised - billed
    assert b.forecast_gross_profit == 27_750.0
    assert round(b.forecast_margin_pct, 2) == 25.28


def test_margin_pct_zero_guard():
    """No contract value must not divide-by-zero."""
    assert BuildProject(name="empty").forecast_margin_pct == 0.0


def test_bid_weighted_value():
    bid = BidOpportunity(name="12 Pleasant Ave", bid_amount=360_000.0, win_probability=0.5)
    assert bid.weighted_value == 180_000.0


def test_evidence_label_domain():
    """The honesty tiers are exactly three; nothing can be unlabeled."""
    assert {e.value for e in EvidenceLabel} == {"verified", "reported", "estimated"}


@pytest.mark.asyncio
async def test_five_ledgers_persist(session):
    bid = BidOpportunity(
        name="Taco Bell", category=JobCategory.COMMERCIAL, status=BidStatus.BIDDING,
        bid_amount=250_000.0, win_probability=0.4, evidence_label=EvidenceLabel.ESTIMATED,
    )
    build = BuildProject(
        name="16 Warehouse Ln", category=JobCategory.NEW_CONSTRUCTION,
        status=BuildStatus.ACTIVE, original_contract_value=216_500.0,
        evidence_label=EvidenceLabel.VERIFIED,
    )
    session.add_all([bid, build])
    await session.flush()

    co = ChangeOrderAWO(
        build_project_id=build.id, title="Added egress window", amount=4_200.0,
        evidence_label=EvidenceLabel.REPORTED,
    )
    ev = ProjectEvent(
        build_project_id=build.id, event_type="inspection_passed",
        summary="Framing inspection passed", evidence_label=EvidenceLabel.VERIFIED,
    )
    fin = ProjectFinancial(
        build_project_id=build.id, entry_type="payment", amount=50_000.0,
        evidence_label=EvidenceLabel.VERIFIED,
    )
    session.add_all([co, ev, fin])
    await session.commit()

    # Default evidence label landed as REPORTED on a row that didn't set it.
    plain = BuildProject(name="default-label", original_contract_value=1.0)
    session.add(plain)
    await session.commit()
    assert plain.evidence_label is EvidenceLabel.REPORTED

    got = (await session.execute(select(ChangeOrderAWO))).scalars().all()
    assert len(got) == 1 and got[0].amount == 4_200.0
