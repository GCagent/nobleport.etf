"""
Tests for the Proposal Engine.

These assert the spec's contract rule end to end: a proposal is built from an
estimate, line items carry a labor/material split and allowance rollup, the
contract-readiness gate blocks a vague proposal from being sent, and e-sign
acceptance trips the deposit gate (creating a job in PENDING_DEPOSIT) without
moving any money.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import backend.models  # noqa: F401 - register all models on Base.metadata
from backend.config.database import Base
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead
from backend.models.proposal import ProposalStatus, ScopeKind
from backend.services.proposal_engine import (
    ProposalEngine,
    ProposalValidationError,
)


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as session:
        yield session
    await engine.dispose()


async def _seed_estimate(db: AsyncSession) -> Estimate:
    lead = Lead(
        first_name="Dana",
        last_name="Rivera",
        email="dana@example.com",
        phone="555-0100",
        property_address="12 Birch Lane",
        city="Newbury",
        state="MA",
        zip_code="01951",
    )
    db.add(lead)
    await db.flush()

    estimate = Estimate(
        lead_id=lead.id,
        estimate_number="EST-0001",
        project_name="Kitchen Remodel",
        client_name="Dana Rivera",
        client_email="dana@example.com",
        client_phone="555-0100",
        status=EstimateStatus.DRAFT,
        base_value=40000.0,
        markup_percent=20.0,
        deposit_percent=30.0,
        scope_description="Full kitchen remodel with new cabinetry.",
    )
    db.add(estimate)
    await db.commit()
    return estimate


async def _build_ready_proposal(db: AsyncSession):
    estimate = await _seed_estimate(db)
    proposal = await ProposalEngine.create_from_estimate(estimate.id, db)

    await ProposalEngine.add_line_item(
        proposal.id, db,
        description="Demolition & disposal",
        quantity=1, labor_cost=3000, material_cost=500,
    )
    await ProposalEngine.add_line_item(
        proposal.id, db,
        description="Custom cabinetry",
        quantity=1, labor_cost=4000, material_cost=12000,
    )
    await ProposalEngine.add_line_item(
        proposal.id, db,
        description="Tile allowance",
        quantity=1, labor_cost=0, material_cost=2500, is_allowance=True,
    )
    await ProposalEngine.add_scope_item(
        proposal.id, db, ScopeKind.INCLUSION, "All labor and materials above."
    )
    await ProposalEngine.add_scope_item(
        proposal.id, db, ScopeKind.EXCLUSION, "Appliances supplied by owner."
    )
    await ProposalEngine.add_scope_item(
        proposal.id, db, ScopeKind.ASSUMPTION, "Existing plumbing is to code."
    )
    await ProposalEngine.generate_default_schedule(proposal.id, db)
    return estimate, await ProposalEngine.get(proposal.id, db)


@pytest.mark.asyncio
async def test_create_from_estimate_seeds_client_and_scope(db):
    estimate = await _seed_estimate(db)
    proposal = await ProposalEngine.create_from_estimate(estimate.id, db)

    assert proposal.proposal_number == "PROP-0001"
    assert proposal.client_name == "Dana Rivera"
    assert proposal.project_address == "12 Birch Lane, Newbury, MA, 01951"
    assert proposal.markup_percent == 20.0
    # The estimate scope description seeds an inclusion.
    assert any(s.kind == ScopeKind.INCLUSION for s in proposal.scope_items)
    assert proposal.status == ProposalStatus.DRAFT


@pytest.mark.asyncio
async def test_totals_split_labor_material_and_allowances(db):
    _, proposal = await _build_ready_proposal(db)

    # labor: 3000 + 4000 + 0 = 7000 ; material: 500 + 12000 + 2500 = 15000
    assert proposal.labor_total == 7000.0
    assert proposal.material_total == 15000.0
    assert proposal.subtotal == 22000.0
    assert proposal.allowance_total == 2500.0
    # markup 20% -> 4400 ; total 26400 ; deposit 30% -> 7920
    assert proposal.markup_amount == 4400.0
    assert proposal.total == 26400.0
    assert proposal.deposit_amount == 7920.0


@pytest.mark.asyncio
async def test_default_schedule_sums_to_total(db):
    _, proposal = await _build_ready_proposal(db)
    pct = sum(m.percent for m in proposal.milestones)
    amt = sum(m.amount for m in proposal.milestones)
    assert round(pct, 2) == 100.0
    assert round(amt, 2) == proposal.total
    assert proposal.milestones[0].name == "Deposit"


@pytest.mark.asyncio
async def test_send_blocked_until_contract_ready(db):
    estimate = await _seed_estimate(db)
    proposal = await ProposalEngine.create_from_estimate(estimate.id, db)
    # Only the seeded inclusion exists — no priced scope, no exclusions, etc.
    with pytest.raises(ProposalValidationError):
        await ProposalEngine.send(proposal.id, db)

    blockers = ProposalEngine.readiness(proposal)
    assert any("line items" in b for b in blockers)
    assert any("exclusions" in b for b in blockers)


@pytest.mark.asyncio
async def test_accept_trips_deposit_gate_and_creates_job(db):
    estimate, proposal = await _build_ready_proposal(db)
    await ProposalEngine.send(proposal.id, db)

    result = await ProposalEngine.accept(
        proposal.id, db, signer_name="Dana Rivera", signer_ip="203.0.113.7"
    )

    assert result["deposit_gate"]["status"] == "job_created_pending_deposit"
    signed = await ProposalEngine.get(proposal.id, db)
    assert signed.status == ProposalStatus.SIGNED
    assert signed.signer_name == "Dana Rivera"
    assert signed.signed_at is not None

    # A job was created in PENDING_DEPOSIT with the deposit required, no money moved.
    job = (await db.execute(__import__("sqlalchemy").select(Job))).scalar_one()
    assert job.status == JobStatus.PENDING_DEPOSIT
    assert job.deposit_required == proposal.deposit_amount
    assert job.deposit_paid == 0.0
    assert job.deposit_gate_passed is False


@pytest.mark.asyncio
async def test_signed_proposal_is_locked(db):
    estimate, proposal = await _build_ready_proposal(db)
    await ProposalEngine.send(proposal.id, db)
    await ProposalEngine.accept(proposal.id, db, signer_name="Dana Rivera")

    with pytest.raises(ProposalValidationError):
        await ProposalEngine.add_line_item(
            proposal.id, db, description="Sneaky add", labor_cost=5000
        )


@pytest.mark.asyncio
async def test_render_html_contains_key_sections(db):
    _, proposal = await _build_ready_proposal(db)
    doc = ProposalEngine.render_html(proposal)
    assert "Scope &amp; Pricing" in doc
    assert "Payment Schedule" in doc
    assert "Custom cabinetry" in doc
    assert "ALLOWANCE" in doc
    assert proposal.proposal_number in doc


@pytest.mark.asyncio
async def test_payment_schedule_must_sum_to_100(db):
    estimate = await _seed_estimate(db)
    proposal = await ProposalEngine.create_from_estimate(estimate.id, db)
    with pytest.raises(ProposalValidationError):
        await ProposalEngine.set_payment_schedule(
            proposal.id, db, [{"name": "Half", "percent": 50}]
        )
