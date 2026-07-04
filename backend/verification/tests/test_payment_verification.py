"""
Payment Verification  (audit issue #2)
======================================

The audit's objection: verification POSTed to ``/api/payments/test``, a route
that was never implemented. There is no generic test endpoint — the real payment
surface is the deposit checkout flow. This test exercises the *actual* registered
endpoint, ``POST /api/payments/checkout/deposit``, end to end against a real
(in-memory) database via FastAPI's ASGI transport, and proves the deposit gate
business rule the revenue engine depends on.

What this proves (real runtime evidence, no live Stripe call required):
  * the route is addressable and returns a Stripe-ready checkout payload
  * the amount is derived from the job's deposit_required (cents-correct)
  * a PENDING Payment row is persisted
  * the deposit gate is closed until a webhook confirms payment
  * an already-paid job is rejected (idempotency / double-charge guard)
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import backend.models  # noqa: F401 - register all models on Base.metadata
from backend.config.database import Base, get_db
from backend.main import app
from backend.models.estimate import Estimate, EstimateStatus
from backend.models.job import Job, JobStatus
from backend.models.payment import Payment, PaymentStatus, PaymentType


@pytest_asyncio.fixture
async def client():
    """FastAPI app wired to an isolated in-memory database."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)

    async def _override_get_db():
        async with session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://verify") as ac:
        ac._session_maker = session_maker  # type: ignore[attr-defined]
        yield ac
    app.dependency_overrides.pop(get_db, None)
    await engine.dispose()


async def _seed_job(session_maker, *, deposit_required: float = 5000.0) -> str:
    async with session_maker() as db:
        estimate = Estimate(
            estimate_number="EST-VERIFY-001",
            project_name="Verification Project",
            client_name="Verification Client",
            client_email="verify@nobleport.test",
            status=EstimateStatus.WON,
            total_value=25000.0,
        )
        db.add(estimate)
        await db.commit()
        await db.refresh(estimate)

        job = Job(
            estimate_id=estimate.id,
            job_number="JOB-VERIFY-001",
            status=JobStatus.PENDING_DEPOSIT,
            deposit_required=deposit_required,
            contract_value=25000.0,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job.id


@pytest.mark.asyncio
async def test_deposit_checkout_uses_real_route_and_returns_payload(client):
    job_id = await _seed_job(client._session_maker, deposit_required=5000.0)

    resp = await client.post(
        "/api/payments/checkout/deposit", params={"job_id": job_id}
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "checkout_ready"
    assert body["amount"] == 5000.0
    # Stripe-ready payload, amount in cents, deposit-typed metadata.
    payload = body["checkout_payload"]
    assert payload["line_items"][0]["price_data"]["unit_amount"] == 500000
    assert payload["metadata"]["payment_type"] == "deposit"


@pytest.mark.asyncio
async def test_deposit_checkout_persists_pending_payment_and_holds_gate(client):
    job_id = await _seed_job(client._session_maker)
    await client.post("/api/payments/checkout/deposit", params={"job_id": job_id})

    async with client._session_maker() as db:
        from sqlalchemy import select

        payment = (
            await db.execute(select(Payment).where(Payment.job_id == job_id))
        ).scalar_one()
        assert payment.status == PaymentStatus.PENDING
        assert payment.payment_type == PaymentType.DEPOSIT

        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
        # Creating a checkout must NOT move money or open the gate.
        assert job.deposit_gate_passed is False
        assert job.status == JobStatus.PENDING_DEPOSIT


@pytest.mark.asyncio
async def test_deposit_checkout_unknown_job_is_rejected(client):
    resp = await client.post(
        "/api/payments/checkout/deposit", params={"job_id": "does-not-exist"}
    )
    assert resp.status_code == 400
    assert "not found" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_deposit_checkout_rejects_already_paid_job(client):
    job_id = await _seed_job(client._session_maker)
    async with client._session_maker() as db:
        from sqlalchemy import select

        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one()
        job.deposit_gate_passed = True
        await db.commit()

    resp = await client.post(
        "/api/payments/checkout/deposit", params={"job_id": job_id}
    )
    assert resp.status_code == 400
    assert "already paid" in resp.json()["detail"].lower()
