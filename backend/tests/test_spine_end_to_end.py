"""
End-to-end revenue spine validation (Priority 1).

Drives one job through the ENTIRE spine using the real HTTP API and the real
services — no mocks of NoblePort code anywhere on the path:

    Lead → Estimate → Proposal (contract-ready) → e-sign accept
        → deposit gate (Stripe webhook lifecycle handler)
        → job activation → project + daily log
        → invoice → final payment → job complete
        → GCagent closeout package (completeness gates)

Two hops are seeded directly in the database and are called out inline,
because the API surface for them does not exist yet. They are the honest
gaps this test documents rather than papers over:

  1. Job → Project linkage: nothing in the API sets ``job.project_id``
     (the Contract role, spine role #5, is PLANNED in
     backend/config/revenue_spine.py).
  2. Permits / inspections / photos: created by PermitStream + field tooling
     in production; there is no public CRUD route for them today.

External boundaries (Stripe signature verification, HubSpot network sync)
are validated separately in backend/verification/tests; here the webhook
payload enters at the lifecycle-handler boundary, exactly as the verified
signature path would deliver it.
"""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import backend.models  # noqa: F401 - register all models on Base.metadata
from backend.agents import gcagent as gcagent_module
from backend.agents.gcagent import GCAgent
from backend.config.database import Base, get_db
from backend.main import app
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.job import Job, JobStatus
from backend.models.lead import Lead, LeadStatus
from backend.models.media import MediaFile, MediaType
from backend.models.payment import Payment, PaymentStatus
from backend.models.permit import Permit, PermitStatus, PermitType
from backend.services import stripe_service as stripe_module
from backend.services.stripe_service import StripeService


# ===========================================================================
# Harness: real app, real routes, in-memory database
# ===========================================================================

@pytest_asyncio.fixture
async def harness(monkeypatch):
    """HTTP client against the real FastAPI app + shared session maker."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    # These two open their own sessions via a module-level name.
    monkeypatch.setattr(stripe_module, "async_session", session_maker)
    monkeypatch.setattr(gcagent_module, "async_session", session_maker)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://spine") as client:
        yield client, session_maker

    app.dependency_overrides.clear()
    await engine.dispose()


async def _post(client: AsyncClient, url: str, expect: int = 200, **kwargs):
    resp = await client.post(url, **kwargs)
    assert resp.status_code == expect, f"POST {url} -> {resp.status_code}: {resp.text}"
    return resp.json() if resp.content else None


async def _create_contract_ready_proposal(client: AsyncClient) -> dict:
    """Lead → estimate → priced, scoped, scheduled proposal. Returns proposal."""
    lead = await _post(
        client, "/api/leads", expect=201,
        json={
            "first_name": "Dana", "last_name": "Rivera",
            "email": "dana@example.com", "phone": "555-0100",
            "source": "website",
            "property_address": "12 Birch Lane", "city": "Newbury",
            "state": "MA", "zip_code": "01951",
        },
    )
    estimate = await _post(
        client, "/api/estimates", expect=201,
        json={
            "lead_id": lead["id"], "estimate_number": "EST-E2E-1",
            "project_name": "Kitchen Remodel",
            "base_value": 40000.0, "markup_percent": 20.0,
            "deposit_percent": 30.0,
            "scope_description": "Full kitchen remodel with new cabinetry.",
        },
    )
    proposal = await _post(
        client, "/api/proposals", expect=201,
        json={"estimate_id": estimate["id"]},
    )
    pid = proposal["id"]
    for item in (
        {"description": "Demolition & disposal", "quantity": 1,
         "labor_cost": 3000, "material_cost": 500},
        {"description": "Custom cabinetry", "quantity": 1,
         "labor_cost": 4000, "material_cost": 12000},
        {"description": "Tile allowance", "quantity": 1,
         "labor_cost": 0, "material_cost": 2500, "is_allowance": True},
    ):
        proposal = await _post(client, f"/api/proposals/{pid}/line-items", json=item)
    for kind, text in (
        ("inclusion", "All labor and materials above."),
        ("exclusion", "Appliances supplied by owner."),
        ("assumption", "Existing plumbing is to code."),
    ):
        proposal = await _post(
            client, f"/api/proposals/{pid}/scope-items",
            json={"kind": kind, "text": text},
        )
    proposal = await _post(client, f"/api/proposals/{pid}/payment-schedule/auto")
    return proposal


def _checkout_completed_event(job_id: str, amount: float, payment_type: str) -> dict:
    """Stripe checkout.session.completed payload as the webhook delivers it.

    IDs are unique per event, as Stripe guarantees — the payments ledger has a
    unique constraint on the session id (replay/idempotency protection).
    """
    nonce = uuid4().hex[:8]
    return {
        "object": {
            "id": f"cs_test_{payment_type}_{nonce}",
            "payment_intent": f"pi_test_{payment_type}_{nonce}",
            "amount_total": int(round(amount * 100)),
            "metadata": {"job_id": job_id, "payment_type": payment_type},
        }
    }


# ===========================================================================
# E2E #1 — golden path: signed contract to closeout-ready package
# ===========================================================================

@pytest.mark.asyncio
async def test_full_spine_lead_to_closeout(harness):
    client, session_maker = harness
    proposal = await _create_contract_ready_proposal(client)
    pid = proposal["id"]

    # Contract math on the wire matches the signed pricing rule:
    # subtotal 22,000 + 20% markup = 26,400; 30% deposit = 7,920.
    assert proposal["total"] == 26400.0
    assert proposal["deposit_amount"] == 7920.0

    await _post(client, f"/api/proposals/{pid}/send")
    await _post(client, f"/api/proposals/{pid}/view")
    accepted = await _post(
        client, f"/api/proposals/{pid}/accept",
        json={"signer_name": "Dana Rivera", "signer_ip": "203.0.113.7"},
    )
    assert accepted["status"] == "signed"
    gate = accepted["deposit_gate"]
    assert gate["status"] == "job_created_pending_deposit"
    assert gate["deposit_required"] == 7920.0
    job_id = gate["job_id"]

    # Signing flipped the whole upstream pipeline to WON.
    lead_rows = (await client.get("/api/leads")).json()["items"]
    assert lead_rows[0]["status"] == LeadStatus.WON.value
    est = (await client.get(f"/api/estimates/{gate['estimate_id']}")).json()
    assert est["status"] == "won"
    # Signed proposal totals were synced back onto the estimate (contract rule).
    assert est["total_value"] == 26400.0

    # Deposit clears via the Stripe lifecycle handler → gate passes.
    result = await StripeService().handle_webhook_event(
        "checkout.session.completed",
        _checkout_completed_event(job_id, 7920.0, "deposit"),
    )
    assert result["deposit_gate_passed"] is True
    assert result["job_status"] == JobStatus.SCHEDULED.value

    job = (await client.get(f"/api/jobs/{job_id}")).json()
    assert job["deposit_gate_passed"] is True
    assert job["contract_value"] == 26400.0
    # Site address flowed from the lead through the estimate to the job.
    assert job["site_address"] == "12 Birch Lane"

    activated = await _post(client, f"/api/jobs/{job_id}/activate")
    assert activated["status"] == JobStatus.IN_PROGRESS.value

    # Build stage: project record + daily log through the API.
    project = await _post(
        client, "/api/projects", expect=201,
        json={"name": "Kitchen Remodel", "project_type": "residential_renovation",
              "address": "12 Birch Lane", "city": "Newbury", "state": "MA"},
    )
    await _post(
        client, f"/api/projects/{project['id']}/daily-logs", expect=201,
        json={"project_id": project["id"], "log_date": str(date.today()),
              "author": "Site Super", "crew_count": 4,
              "work_performed": "Demo complete; cabinet install started."},
    )

    # DOCUMENTED GAP: no API route sets job.project_id (Contract role #5 is
    # PLANNED). Permits/inspections/photos likewise have no CRUD route yet.
    async with session_maker() as db:
        db_job = await db.get(Job, job_id)
        db_job.project_id = project["id"]
        permit = Permit(
            job_id=job_id, permit_number="BP-2026-e2e", ahj="Newbury",
            permit_type=PermitType.BUILDING, status=PermitStatus.ISSUED,
            issued_at=datetime.now(timezone.utc),
        )
        db.add(permit)
        await db.flush()
        db.add(Inspection(
            permit_id=permit.id, job_id=job_id, inspection_type="final",
            status=InspectionStatus.PASSED,
            completed_at=datetime.now(timezone.utc),
        ))
        db.add(MediaFile(
            project_id=project["id"], filename="final.jpg",
            original_filename="final.jpg", file_path="/media/final.jpg",
            file_size_bytes=1024, mime_type="image/jpeg",
            media_type=MediaType.PHOTO, uploaded_by="Site Super",
        ))
        await db.commit()

    # Invoice the remaining balance and collect it.
    remaining = 26400.0 - 7920.0
    invoice = await _post(
        client, "/api/invoices", expect=201,
        json={"project_id": project["id"], "invoice_number": "INV-E2E-1",
              "description": "Final draw", "subtotal": remaining},
    )
    assert invoice["balance_due"] == remaining

    result = await StripeService().handle_webhook_event(
        "checkout.session.completed",
        _checkout_completed_event(job_id, remaining, "final"),
    )
    assert result["status"] == "success"

    paid_invoice = (await client.patch(
        f"/api/invoices/{invoice['id']}",
        json={"amount_paid": invoice["total"], "status": "paid",
              "paid_date": datetime.now(timezone.utc).isoformat()},
    )).json()
    assert paid_invoice["balance_due"] == 0.0

    completed = await _post(client, f"/api/jobs/{job_id}/complete")
    assert completed["status"] == JobStatus.COMPLETE.value
    assert completed["total_paid"] == 26400.0

    # Closeout: GCagent assembles the package and every gate is green.
    package = await GCAgent().generate_closeout_package(job_id)
    assert package["completeness"] == "complete", package["missing"]
    assert package["missing"] == []
    fin = package["financials"]
    assert fin["contract_value"] == 26400.0
    assert fin["total_paid"] == 26400.0
    assert fin["verified_payments"] == 26400.0
    assert fin["balance_due"] == 0.0
    art = package["artifacts"]
    assert art["payment_count"] == 2
    assert art["photo_count"] == 1
    assert art["permits"][0]["status"] == "issued"
    assert art["inspections"][0]["status"] == "passed"

    # The payments ledger holds both PAID rows — deposit and final.
    async with session_maker() as db:
        rows = (await db.execute(
            select(Payment).where(Payment.job_id == job_id,
                                  Payment.status == PaymentStatus.PAID)
        )).scalars().all()
        assert sorted(p.payment_type.value for p in rows) == ["deposit", "final"]


# ===========================================================================
# E2E #2 — the gates actually block: readiness, deposit, activation
# ===========================================================================

@pytest.mark.asyncio
async def test_gates_block_unready_and_unpaid_advancement(harness):
    client, _ = harness

    # A bare proposal (no line items / scope / schedule) cannot be sent...
    lead = await _post(
        client, "/api/leads", expect=201,
        json={"first_name": "Sam", "last_name": "Okafor", "source": "referral"},
    )
    estimate = await _post(
        client, "/api/estimates", expect=201,
        json={"lead_id": lead["id"], "estimate_number": "EST-E2E-2",
              "project_name": "Deck Rebuild", "base_value": 18000.0},
    )
    proposal = await _post(client, "/api/proposals", expect=201,
                           json={"estimate_id": estimate["id"]})
    resp = await client.post(f"/api/proposals/{proposal['id']}/send")
    assert resp.status_code == 422
    assert "not contract-ready" in resp.json()["detail"]

    # ...and cannot be accepted either — same gate on the e-sign path.
    resp = await client.post(f"/api/proposals/{proposal['id']}/accept",
                             json={"signer_name": "Sam Okafor"})
    assert resp.status_code == 422

    # A contract-ready proposal signs fine, but the job it creates cannot be
    # activated before the deposit clears.
    ready = await _create_contract_ready_proposal(client)
    await _post(client, f"/api/proposals/{ready['id']}/send")
    accepted = await _post(client, f"/api/proposals/{ready['id']}/accept",
                           json={"signer_name": "Dana Rivera"})
    job_id = accepted["deposit_gate"]["job_id"]

    resp = await client.post(f"/api/jobs/{job_id}/activate")
    assert resp.status_code == 400
    assert "deposit not paid" in resp.json()["detail"]

    # A short deposit does NOT pass the gate.
    result = await StripeService().handle_webhook_event(
        "checkout.session.completed",
        _checkout_completed_event(job_id, 1000.0, "deposit"),
    )
    assert result["deposit_gate_passed"] is False
    resp = await client.post(f"/api/jobs/{job_id}/activate")
    assert resp.status_code == 400

    # Topping it up to the required amount does.
    result = await StripeService().handle_webhook_event(
        "checkout.session.completed",
        _checkout_completed_event(job_id, 6920.0, "deposit"),
    )
    assert result["deposit_gate_passed"] is True
    activated = await _post(client, f"/api/jobs/{job_id}/activate")
    assert activated["status"] == JobStatus.IN_PROGRESS.value


# ===========================================================================
# E2E #3 — closeout refuses to certify an incomplete job
# ===========================================================================

@pytest.mark.asyncio
async def test_closeout_reports_incomplete_until_every_gate_clears(harness):
    client, session_maker = harness

    proposal = await _create_contract_ready_proposal(client)
    await _post(client, f"/api/proposals/{proposal['id']}/send")
    accepted = await _post(client, f"/api/proposals/{proposal['id']}/accept",
                           json={"signer_name": "Dana Rivera"})
    job_id = accepted["deposit_gate"]["job_id"]

    project = await _post(
        client, "/api/projects", expect=201,
        json={"name": "Kitchen Remodel", "project_type": "residential_renovation"},
    )
    unpaid = await _post(
        client, "/api/invoices", expect=201,
        json={"project_id": project["id"], "invoice_number": "INV-E2E-OPEN",
              "subtotal": 26400.0},
    )
    assert unpaid["balance_due"] == 26400.0

    # Seed the job into the project with an unissued permit and an
    # unpassed inspection (no API surface — see module docstring).
    async with session_maker() as db:
        db_job = await db.get(Job, job_id)
        db_job.project_id = project["id"]
        permit = Permit(job_id=job_id, permit_number="BP-2026-open",
                        ahj="Newbury", permit_type=PermitType.BUILDING,
                        status=PermitStatus.REVIEW)
        db.add(permit)
        await db.flush()
        db.add(Inspection(permit_id=permit.id, job_id=job_id,
                          inspection_type="rough",
                          status=InspectionStatus.SCHEDULED))
        await db.commit()

    package = await GCAgent().generate_closeout_package(job_id)
    assert package["completeness"] == "incomplete"
    missing = " | ".join(package["missing"])
    assert "permit(s) not issued" in missing
    assert "inspection(s) not passed" in missing
    assert "Deposit gate not passed" in missing
    assert "balance still due" in missing
    assert "No project photos on file" in missing
