"""
End-to-end revenue spine workflow tests.

Three full workflow validations driven through the real FastAPI app over
HTTP against an isolated database — the staging equivalent of the live
validation runs on the sprint board. Same routes, same services, same gate
enforcement; only the Stripe webhook delivery is simulated at the boundary
(the event payload is handed to the same handler the live webhook uses).

  1. Fast estimate path: Lead -> Estimate -> Approve -> Job, with the
     deposit gate rejecting activation until the deposit clears.
  2. Proposal contract path: the contract-readiness gate blocks a vague
     proposal, and e-sign acceptance syncs signed pricing onto the
     estimate, job, and deposit gate.
  3. Financial rollups: change orders, invoices, and the pipeline
     snapshot all reconcile against the source records they summarize.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import backend.models  # noqa: F401 - register all models on Base.metadata
import backend.config.database as database_module
import backend.services.stripe_service as stripe_module
from backend.config.database import Base
from backend.main import app
from backend.services.stripe_service import StripeService


@pytest_asyncio.fixture
async def client(monkeypatch):
    """HTTP client against the real app, wired to an isolated database.

    StaticPool keeps every session on one in-memory SQLite connection so
    request-scoped sessions (get_db) and the Stripe handler's own session
    see the same data, exactly as they share Postgres in production.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:", poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    monkeypatch.setattr(database_module, "async_session", session_maker)
    monkeypatch.setattr(stripe_module, "async_session", session_maker)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await engine.dispose()


async def _create_lead(client: AsyncClient, **overrides) -> dict:
    payload = {
        "first_name": "Dana",
        "last_name": "Rivera",
        "email": "dana@example.com",
        "phone": "555-0100",
        "source": "website",
        "property_address": "12 Birch Lane",
        "city": "Newbury",
        "state": "MA",
        "zip_code": "01951",
    }
    payload.update(overrides)
    resp = await client.post("/api/leads", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_estimate(client: AsyncClient, lead_id: str, **overrides) -> dict:
    payload = {
        "lead_id": lead_id,
        "estimate_number": "EST-E2E-1",
        "project_name": "Kitchen Remodel",
        "base_value": 100_000.0,
        "markup_percent": 20.0,
        "deposit_percent": 30.0,
    }
    payload.update(overrides)
    resp = await client.post("/api/estimates", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _pay_deposit(job: dict) -> None:
    """Deliver the checkout.session.completed event the live webhook would."""
    result = await StripeService().handle_webhook_event(
        "checkout.session.completed",
        {
            "object": {
                "id": "cs_test_e2e",
                "payment_intent": "pi_test_e2e",
                "amount_total": int(job["deposit_required"] * 100),
                "metadata": {"job_id": job["id"], "payment_type": "deposit"},
            }
        },
    )
    assert result.get("status") != "error", result


async def _won_job(client: AsyncClient, estimate_number: str = "EST-E2E-1") -> dict:
    """Lead -> estimate -> sent -> approved. Returns the created job."""
    lead = await _create_lead(client)
    estimate = await _create_estimate(
        client, lead["id"], estimate_number=estimate_number
    )
    resp = await client.post(f"/api/estimates/{estimate['id']}/send")
    assert resp.status_code == 200, resp.text
    resp = await client.post(f"/api/estimates/{estimate['id']}/approve")
    assert resp.status_code == 200, resp.text
    gate = resp.json()
    resp = await client.get(f"/api/jobs/{gate['job_id']}")
    assert resp.status_code == 200, resp.text
    return resp.json()


# =============================================================================
# Workflow 1 — fast estimate path with deposit gate enforcement
# =============================================================================

@pytest.mark.asyncio
async def test_estimate_to_completed_job_enforces_deposit_gate(client):
    lead = await _create_lead(client)
    assert lead["status"] == "new"

    estimate = await _create_estimate(client, lead["id"])
    assert estimate["markup_amount"] == pytest.approx(20_000.0)
    assert estimate["total_value"] == pytest.approx(120_000.0)
    assert estimate["deposit_amount"] == pytest.approx(36_000.0)

    # Creating an estimate qualifies the lead; sending moves it forward.
    lead_now = (await client.get(f"/api/leads/{lead['id']}")).json()
    assert lead_now["status"] == "qualified"
    resp = await client.post(f"/api/estimates/{estimate['id']}/send")
    assert resp.status_code == 200
    lead_now = (await client.get(f"/api/leads/{lead['id']}")).json()
    assert lead_now["status"] == "proposal_sent"

    # Client approval auto-creates the job behind the deposit gate.
    resp = await client.post(f"/api/estimates/{estimate['id']}/approve")
    assert resp.status_code == 200
    gate = resp.json()
    assert gate["status"] == "job_created_pending_deposit"
    assert gate["deposit_required"] == pytest.approx(36_000.0)

    job = (await client.get(f"/api/jobs/{gate['job_id']}")).json()
    assert job["status"] == "pending_deposit"
    assert job["contract_value"] == pytest.approx(120_000.0)
    assert job["site_address"] == "12 Birch Lane"

    # DEPOSIT GATE: activation must be rejected before the deposit clears.
    resp = await client.post(f"/api/jobs/{job['id']}/activate")
    assert resp.status_code == 400
    assert "deposit not paid" in resp.json()["detail"]

    await _pay_deposit(job)

    job = (await client.get(f"/api/jobs/{job['id']}")).json()
    assert job["deposit_gate_passed"] is True
    assert job["deposit_paid"] == pytest.approx(36_000.0)
    assert job["status"] == "scheduled"

    resp = await client.post(f"/api/jobs/{job['id']}/activate")
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"

    resp = await client.post(f"/api/jobs/{job['id']}/complete")
    assert resp.status_code == 200
    done = resp.json()
    assert done["status"] == "complete"
    assert done["actual_end_date"] is not None

    lead_final = (await client.get(f"/api/leads/{lead['id']}")).json()
    assert lead_final["status"] == "won"


# =============================================================================
# Workflow 2 — proposal contract path with contract-readiness gate
# =============================================================================

@pytest.mark.asyncio
async def test_proposal_contract_gate_and_esign_acceptance(client):
    lead = await _create_lead(client)
    estimate = await _create_estimate(client, lead["id"])

    resp = await client.post("/api/proposals", json={"estimate_id": estimate["id"]})
    assert resp.status_code == 201, resp.text
    proposal = resp.json()

    # CONTRACT-READINESS GATE: a vague proposal must not go out the door.
    resp = await client.post(f"/api/proposals/{proposal['id']}/send")
    assert resp.status_code == 422
    assert "not contract-ready" in resp.json()["detail"]

    for line in (
        {"description": "Demo & disposal", "labor_cost": 4_000.0, "material_cost": 1_000.0},
        {"description": "Framing & rough carpentry", "labor_cost": 20_000.0, "material_cost": 15_000.0},
    ):
        resp = await client.post(
            f"/api/proposals/{proposal['id']}/line-items", json=line
        )
        assert resp.status_code == 200, resp.text

    for kind, text in (
        ("inclusion", "All framing lumber and fasteners"),
        ("exclusion", "Structural engineering fees"),
        ("assumption", "Site accessible weekdays 7am-4pm"),
    ):
        resp = await client.post(
            f"/api/proposals/{proposal['id']}/scope-items",
            json={"kind": kind, "text": text},
        )
        assert resp.status_code == 200, resp.text

    resp = await client.put(
        f"/api/proposals/{proposal['id']}/payment-schedule",
        json={
            "milestones": [
                {"name": "Deposit", "milestone_type": "deposit", "percent": 30.0},
                {"name": "Rough-in complete", "milestone_type": "progress", "percent": 40.0},
                {"name": "Final", "milestone_type": "final", "percent": 30.0},
            ]
        },
    )
    assert resp.status_code == 200, resp.text
    proposal = resp.json()
    assert proposal["subtotal"] == pytest.approx(40_000.0)

    resp = await client.post(f"/api/proposals/{proposal['id']}/send")
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "sent"

    resp = await client.post(f"/api/proposals/{proposal['id']}/view")
    assert resp.status_code == 200
    assert resp.json()["status"] == "viewed"

    resp = await client.post(
        f"/api/proposals/{proposal['id']}/accept",
        json={"signer_name": "Dana Rivera", "signer_email": "dana@example.com"},
    )
    assert resp.status_code == 200, resp.text
    gate = resp.json()["deposit_gate"]

    # The signed proposal IS the contract: estimate and job must carry the
    # signed numbers, not the stale pre-proposal figures.
    proposal = (await client.get(f"/api/proposals/{proposal['id']}")).json()
    estimate = (await client.get(f"/api/estimates/{estimate['id']}")).json()
    assert estimate["status"] == "won"
    assert estimate["total_value"] == pytest.approx(proposal["total"])
    assert estimate["deposit_amount"] == pytest.approx(proposal["deposit_amount"])

    job = (await client.get(f"/api/jobs/{gate['job_id']}")).json()
    assert job["status"] == "pending_deposit"
    assert job["contract_value"] == pytest.approx(proposal["total"])
    assert job["deposit_required"] == pytest.approx(proposal["deposit_amount"])


# =============================================================================
# Workflow 3 — change orders, invoices, and pipeline rollup integrity
# =============================================================================

@pytest.mark.asyncio
async def test_financial_rollups_reconcile_with_source_records(client):
    # One won job (with deposit paid and work underway)...
    job = await _won_job(client)
    await _pay_deposit(job)
    resp = await client.post(f"/api/jobs/{job['id']}/activate")
    assert resp.status_code == 200

    # ...and one lost estimate, so the win rate has a denominator.
    lost_lead = await _create_lead(
        client, first_name="Lee", last_name="Okafor", email="lee@example.com"
    )
    lost = await _create_estimate(
        client, lost_lead["id"], estimate_number="EST-E2E-2", base_value=50_000.0
    )
    resp = await client.post(f"/api/estimates/{lost['id']}/lose")
    assert resp.status_code == 200

    # Change order: markup math and job rollup.
    resp = await client.post(
        "/api/change-orders",
        json={
            "job_id": job["id"],
            "title": "Sill rot repair",
            "description": "Replace rotted sill discovered during demo",
            "reason": "site_condition",
            "labor_cost": 3_000.0,
            "material_cost": 2_000.0,
            "markup_percent": 20.0,
        },
    )
    assert resp.status_code == 201, resp.text
    change_order = resp.json()
    assert change_order["total_amount"] == pytest.approx(6_000.0)

    resp = await client.post(
        f"/api/change-orders/{change_order['id']}/approve",
        params={"approved_by": "PM"},
    )
    assert resp.status_code == 200, resp.text

    job = (await client.get(f"/api/jobs/{job['id']}")).json()
    assert job["change_order_count"] == 1
    assert job["change_order_total"] == pytest.approx(6_000.0)
    assert job["contract_value"] == pytest.approx(126_000.0)

    # Invoice math: line items -> subtotal -> tax -> retention -> balance.
    resp = await client.post(
        "/api/projects",
        json={
            "name": "Kitchen Remodel",
            "project_type": "residential_renovation",
            "address": "12 Birch Lane",
        },
    )
    assert resp.status_code == 201, resp.text
    project = resp.json()

    resp = await client.post(
        "/api/invoices",
        json={
            "project_id": project["id"],
            "invoice_number": "INV-E2E-1",
            "tax_rate": 6.25,
            "retention_percent": 5.0,
            "line_items": [
                {"description": "Milestone 1: rough-in", "quantity": 1, "unit_price": 48_000.0},
            ],
        },
    )
    assert resp.status_code == 201, resp.text
    invoice = resp.json()
    assert invoice["subtotal"] == pytest.approx(48_000.0)
    assert invoice["tax_amount"] == pytest.approx(3_000.0)
    assert invoice["total"] == pytest.approx(51_000.0)
    assert invoice["balance_due"] == pytest.approx(51_000.0 * 0.95)

    # Pipeline snapshot must reconcile with every source record above.
    resp = await client.get("/api/revenue/pipeline")
    assert resp.status_code == 200, resp.text
    snapshot = resp.json()

    assert snapshot["pipeline"]["total_estimates"] == 2
    assert snapshot["pipeline"]["won_value"] == pytest.approx(120_000.0)
    assert snapshot["pipeline"]["lost_value"] == pytest.approx(60_000.0)
    assert snapshot["pipeline"]["win_rate"] == pytest.approx(50.0)

    assert snapshot["jobs"]["active"] == 1
    assert snapshot["jobs"]["pending_deposit"] == 0
    assert snapshot["jobs"]["total_contract_value"] == pytest.approx(126_000.0)

    assert snapshot["payments"]["total_deposits_collected"] == pytest.approx(36_000.0)
    assert snapshot["payments"]["total_revenue_collected"] == pytest.approx(36_000.0)

    assert snapshot["change_orders"]["total_count"] == 1
    assert snapshot["change_orders"]["total_value"] == pytest.approx(6_000.0)
