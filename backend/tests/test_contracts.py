"""
Tests for the Contract service (spine role #5).

These assert the contract rule end to end: e-signing a proposal freezes it
into an executed contract (immutable pricing/scope/signature snapshot with a
milestone copy), the deposit gate links the contract to the created job,
job activation flips the contract ACTIVE, and approved change orders adjust
current_value while original_value stays exactly what the client signed.
"""

from __future__ import annotations

import json

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import backend.models  # noqa: F401 - register all models on Base.metadata
from backend.config.database import Base
from backend.models.change_order import ChangeOrder, ChangeOrderStatus
from backend.models.contract import ContractStatus
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead
from backend.models.proposal import ScopeKind
from backend.services.contract_service import ContractError, ContractService
from backend.services.proposal_engine import ProposalEngine
from backend.services.revenue_engine import RevenueEngine


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


async def _sign(db: AsyncSession):
    _, proposal = await _build_ready_proposal(db)
    result = await ProposalEngine.accept(
        proposal.id, db,
        signer_name="Dana Rivera",
        signer_email="dana@example.com",
        signer_ip="203.0.113.7",
    )
    return proposal, result


@pytest.mark.asyncio
async def test_signing_executes_contract_with_frozen_snapshot(db):
    proposal, result = await _sign(db)

    assert result["contract_number"] == "CON-0001"
    contract = await ContractService.get(result["contract_id"], db)

    signed = await ProposalEngine.get(proposal.id, db)
    assert contract.status == ContractStatus.EXECUTED
    assert contract.proposal_id == proposal.id
    assert contract.original_value == signed.total
    assert contract.current_value == signed.total
    assert contract.deposit_amount == signed.deposit_amount
    assert contract.signer_name == "Dana Rivera"
    assert contract.signer_ip == "203.0.113.7"
    assert contract.executed_at is not None

    # Milestones are copied, not shared.
    assert len(contract.milestones) == len(signed.milestones)
    assert [m.percent for m in contract.milestones] == [
        m.percent for m in signed.milestones
    ]

    # Scope snapshot freezes line items and narrative as JSON.
    scope = json.loads(contract.scope_snapshot)
    assert len(scope["line_items"]) == 2
    assert scope["exclusions"] == ["Appliances supplied by owner."]


@pytest.mark.asyncio
async def test_contract_links_to_deposit_gate_job(db):
    _, result = await _sign(db)
    contract = await ContractService.get(result["contract_id"], db)
    assert contract.job_id == result["deposit_gate"]["job_id"]


@pytest.mark.asyncio
async def test_unsigned_proposal_cannot_be_executed(db):
    _, proposal = await _build_ready_proposal(db)
    with pytest.raises(ContractError, match="only a signed proposal"):
        await ContractService.execute_from_proposal(proposal.id, db)


@pytest.mark.asyncio
async def test_one_contract_per_signed_proposal(db):
    proposal, _ = await _sign(db)
    with pytest.raises(ContractError, match="already executed"):
        await ContractService.execute_from_proposal(proposal.id, db)


@pytest.mark.asyncio
async def test_job_activation_flips_contract_active(db):
    _, result = await _sign(db)
    job_id = result["deposit_gate"]["job_id"]

    # Simulate the deposit clearing, then activate the job.
    job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
    job.deposit_paid = job.deposit_required
    job.deposit_gate_passed = True
    await db.commit()

    await RevenueEngine.activate_job(job_id, db)

    contract = await ContractService.get_by_job(job_id, db)
    assert contract.status == ContractStatus.ACTIVE
    assert contract.activated_at is not None


@pytest.mark.asyncio
async def test_approved_change_order_adjusts_current_value_only(db):
    _, result = await _sign(db)
    job_id = result["deposit_gate"]["job_id"]
    contract = await ContractService.get(result["contract_id"], db)
    original = contract.original_value

    co = ChangeOrder(
        job_id=job_id,
        change_order_number="AWO-0001",
        title="Add island electrical",
        status=ChangeOrderStatus.PROPOSED,
        total_amount=2500.0,
    )
    db.add(co)
    await db.commit()

    await RevenueEngine.approve_change_order(co.id, "owner", db)

    contract = await ContractService.get(result["contract_id"], db)
    assert contract.original_value == original
    assert contract.change_order_total == 2500.0
    assert contract.current_value == round(original + 2500.0, 2)


@pytest.mark.asyncio
async def test_lifecycle_terminate_records_reason(db):
    _, result = await _sign(db)
    contract = await ContractService.terminate(
        result["contract_id"], db, reason="Client sold the property."
    )
    assert contract.status == ContractStatus.TERMINATED
    assert contract.termination_reason == "Client sold the property."
    # Terminal states are final.
    with pytest.raises(ContractError):
        await ContractService.complete(contract.id, db)
