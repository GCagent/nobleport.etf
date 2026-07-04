"""
Tests for the 20-Agent Revenue Spine decomposition and the Closeout role.

These assert that the role table in backend/config/revenue_spine.py is
internally consistent AND grounded in the real agent mesh: every role maps to
a real spine stage, a real agent family (kept in sync with agents.base), and a
real routed task in the orchestrator's EVENT_ROUTING (when it claims to be
wired). The Closeout role (#20) is then exercised end to end against an
in-memory database to prove the capability actually runs.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import backend.models  # noqa: F401 - register all models on Base.metadata
from backend.agents import gcagent as gcagent_module
from backend.agents.base import AgentFamily
from backend.agents.gcagent import GCAgent
from backend.agents.orchestrator import EVENT_ROUTING
from backend.config.database import Base
from backend.config.revenue_spine import (
    REVENUE_SPINE,
    REVENUE_SPINE_ROLES,
    ImplementationStatus,
    SpineAgentFamily,
    SpineStage,
    get_role,
    roles_by_status,
    roles_for_family,
    roles_for_stage,
    unbuilt_roles,
)
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.invoice import Invoice, InvoiceStatus
from backend.models.job import Job, JobStatus
from backend.models.media import MediaFile, MediaType
from backend.models.payment import (
    Payment,
    PaymentProcessor,
    PaymentStatus,
    PaymentType,
)
from backend.models.permit import Permit, PermitStatus, PermitType
from backend.models.project import Project, ProjectType


# ===========================================================================
# Decomposition consistency (pure)
# ===========================================================================

def test_exactly_twenty_roles_numbered_one_to_twenty():
    numbers = sorted(r.number for r in REVENUE_SPINE_ROLES)
    assert numbers == list(range(1, 21))


def test_role_names_are_unique():
    names = [r.role for r in REVENUE_SPINE_ROLES]
    assert len(names) == len(set(names))


def test_spine_agent_family_mirrors_real_agent_family():
    # The config enum must stay value-identical to the canonical AgentFamily so
    # the import-light config never drifts from the real mesh.
    assert {f.value for f in SpineAgentFamily} == {f.value for f in AgentFamily}


def test_every_role_owned_by_a_real_agent_family():
    real_families = {f.value for f in AgentFamily}
    for role in REVENUE_SPINE_ROLES:
        assert role.agent_family.value in real_families


def test_staged_roles_point_at_real_spine_stages():
    valid_stages = set(SpineStage)
    for role in REVENUE_SPINE_ROLES:
        if role.stage is not None:
            assert role.stage in valid_stages


def test_wired_roles_reference_a_real_routed_task():
    # If a role claims a primary_task, that task must actually route to the
    # SAME family in the orchestrator. This is the anti-drift guarantee.
    for role in REVENUE_SPINE_ROLES:
        if role.primary_task is not None:
            assert role.primary_task in EVENT_ROUTING, (
                f"Role {role.number} ({role.role}) references unrouted task "
                f"{role.primary_task!r}"
            )
            routed_family = EVENT_ROUTING[role.primary_task]
            assert routed_family.value == role.agent_family.value, (
                f"Role {role.number} ({role.role}) routes to "
                f"{routed_family.value}, not its owner {role.agent_family.value}"
            )


def test_implemented_roles_are_backed_by_something():
    for role in REVENUE_SPINE_ROLES:
        assert role.backed_by, f"Role {role.number} ({role.role}) cites no backing"


def test_planned_roles_have_no_wired_task():
    # Honesty check: a PLANNED role must not pretend to be reachable.
    for role in roles_by_status(ImplementationStatus.PLANNED):
        assert role.primary_task is None, (
            f"PLANNED role {role.role} should not advertise a routed task"
        )


def test_every_pipeline_stage_has_at_least_one_role():
    # All seven canonical stages must be represented (cross-cutting roles use
    # stage=None and are excluded here).
    covered = {r.stage for r in REVENUE_SPINE_ROLES if r.stage is not None}
    assert covered == {cfg.stage for cfg in REVENUE_SPINE}


def test_helpers_agree_with_the_table():
    assert get_role(1).role == "Lead Intake"
    assert get_role(20).role == "Closeout"
    with pytest.raises(ValueError):
        get_role(99)

    gc_roles = roles_for_family(SpineAgentFamily.GCAGENT)
    assert {r.role for r in gc_roles} >= {"Production", "Change Order", "Closeout"}

    build_roles = roles_for_stage(SpineStage.BUILD)
    assert all(r.stage == SpineStage.BUILD for r in build_roles)

    # The known backlog today: Contract, eSign, Collections, Vendor Intelligence.
    backlog = {r.role for r in unbuilt_roles()}
    assert backlog == {"Contract", "eSign", "Collections", "Vendor Intelligence",
                       "Qualification"}


def test_closeout_role_is_wired_to_gcagent():
    closeout = get_role(20)
    assert closeout.status is ImplementationStatus.IMPLEMENTED
    assert closeout.stage is SpineStage.CLOSEOUT
    assert closeout.primary_task == "generate_closeout_package"
    assert EVENT_ROUTING["generate_closeout_package"] is AgentFamily.GCAGENT


# ===========================================================================
# Closeout capability (DB-backed, role #20)
# ===========================================================================

@pytest_asyncio.fixture
async def closeout_db(monkeypatch):
    """In-memory engine wired into GCagent's module-level async_session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    # GCagent.generate_closeout_package opens its own session via this name.
    monkeypatch.setattr(gcagent_module, "async_session", session_maker)
    yield session_maker
    await engine.dispose()


async def _seed_job(session_maker, *, complete: bool) -> str:
    """Seed a job and its closeout artifacts. Returns the job id."""
    async with session_maker() as db:
        project = Project(
            name="Harbor View Addition",
            project_type=ProjectType.RESIDENTIAL_RENOVATION,
            address="9 Harbor Rd",
        )
        db.add(project)
        await db.flush()

        job = Job(
            estimate_id="est-closeout-1",
            project_id=project.id,
            job_number="JOB-CO-1",
            status=JobStatus.IN_PROGRESS,
            contract_value=100_000.0,
            change_order_total=5_000.0,
            total_invoiced=105_000.0,
            total_paid=105_000.0 if complete else 80_000.0,
            margin_percent=18.0,
            deposit_gate_passed=True,
            site_address="9 Harbor Rd",
        )
        db.add(job)
        await db.flush()

        permit = Permit(
            job_id=job.id,
            permit_number="BP-2026-001",
            ahj="Boothbay",
            permit_type=PermitType.BUILDING,
            status=PermitStatus.ISSUED if complete else PermitStatus.REVIEW,
        )
        db.add(permit)
        await db.flush()

        db.add(Inspection(
            permit_id=permit.id,
            job_id=job.id,
            inspection_type="final_building",
            status=InspectionStatus.PASSED if complete else InspectionStatus.FAILED,
        ))
        db.add(Invoice(
            project_id=project.id,
            invoice_number="INV-001",
            status=InvoiceStatus.PAID if complete else InvoiceStatus.PARTIALLY_PAID,
            total=105_000.0,
            amount_paid=105_000.0 if complete else 80_000.0,
            balance_due=0.0 if complete else 25_000.0,
        ))
        db.add(Payment(
            job_id=job.id,
            payment_type=PaymentType.FINAL,
            status=PaymentStatus.PAID,
            amount=105_000.0 if complete else 80_000.0,
            processor=PaymentProcessor.STRIPE,
        ))
        if complete:
            db.add(MediaFile(
                project_id=project.id,
                filename="final.jpg",
                original_filename="final.jpg",
                file_path="/media/final.jpg",
                file_size_bytes=1024,
                mime_type="image/jpeg",
                media_type=MediaType.PHOTO,
                uploaded_by="field",
            ))
        await db.commit()
        return job.id


@pytest.mark.asyncio
async def test_closeout_package_complete_path(closeout_db):
    job_id = await _seed_job(closeout_db, complete=True)
    result = await GCAgent().generate_closeout_package(job_id)

    assert result["completeness"] == "complete"
    assert result["missing"] == []
    assert result["financials"]["adjusted_contract"] == 105_000.0
    assert result["financials"]["balance_due"] == 0.0
    assert result["financials"]["verified_payments"] == 105_000.0
    assert len(result["artifacts"]["permits"]) == 1
    assert result["artifacts"]["photo_count"] == 1
    assert result["agent"] == "GCagent"


@pytest.mark.asyncio
async def test_closeout_package_flags_incomplete(closeout_db):
    job_id = await _seed_job(closeout_db, complete=False)
    result = await GCAgent().generate_closeout_package(job_id)

    assert result["completeness"] == "incomplete"
    reasons = " ".join(result["missing"])
    assert "permit" in reasons
    assert "inspection" in reasons
    assert "balance" in reasons
    assert "photo" in reasons
    assert result["financials"]["balance_due"] == 25_000.0


@pytest.mark.asyncio
async def test_closeout_package_unknown_job(closeout_db):
    result = await GCAgent().generate_closeout_package("does-not-exist")
    assert "error" in result
