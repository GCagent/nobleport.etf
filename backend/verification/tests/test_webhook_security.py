"""
Webhook Signature Security Verification  (audit issue #3)
=========================================================

The audit's objection: webhook verification bypassed signature validation. The
audit named Twilio's ``X-Twilio-Signature``; in *this* stack the security-critical
inbound webhook is Stripe (``stripe-signature``, HMAC-SHA256). The principle is
identical: a webhook endpoint that accepts unsigned or tampered payloads is a
remote write primitive into the revenue ledger (it flips deposit gates and marks
jobs paid). Verification MUST prove the signature check actually rejects forgery.

This test exercises the real validator,
``StripeService.verify_webhook_signature``, and the real endpoint,
``POST /api/payments/webhook/stripe``, across the full accept/reject matrix:

  reject: missing signature, malformed signature, wrong secret, tampered payload
  accept: correctly signed payload

Crucially it also asserts the *fail-closed* property: when a webhook secret is
configured, an invalid signature returns 400 and the handler never runs.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import time

import pytest
from httpx import ASGITransport, AsyncClient

import backend.api.payments as payments_module
from backend.main import app
from backend.services.stripe_service import StripeService

WEBHOOK_SECRET = "whsec_verification_test_secret_key_value"


def _sign(payload: bytes, secret: str, timestamp: int | None = None) -> str:
    ts = timestamp if timestamp is not None else int(time.time())
    signed_payload = f"{ts}.{payload.decode('utf-8')}"
    sig = hmac.new(
        secret.encode("utf-8"), signed_payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"t={ts},v1={sig}"


@pytest.fixture
def svc() -> StripeService:
    service = StripeService()
    service.webhook_secret = WEBHOOK_SECRET
    return service


# --------------------------------------------------------------------------
# Validator-level matrix
# --------------------------------------------------------------------------

def test_valid_signature_accepted(svc: StripeService):
    payload = json.dumps({"type": "checkout.session.completed"}).encode()
    sig = _sign(payload, WEBHOOK_SECRET)
    assert svc.verify_webhook_signature(payload, sig) is True


def test_missing_signature_rejected(svc: StripeService):
    payload = b'{"type":"checkout.session.completed"}'
    assert svc.verify_webhook_signature(payload, "") is False


def test_malformed_signature_rejected(svc: StripeService):
    payload = b'{"type":"checkout.session.completed"}'
    assert svc.verify_webhook_signature(payload, "garbage-no-equals") is False


def test_wrong_secret_rejected(svc: StripeService):
    payload = b'{"type":"checkout.session.completed"}'
    sig = _sign(payload, "whsec_attacker_controlled_secret")
    assert svc.verify_webhook_signature(payload, sig) is False


def test_tampered_payload_rejected(svc: StripeService):
    original = json.dumps({"type": "checkout.session.completed", "amt": 100}).encode()
    sig = _sign(original, WEBHOOK_SECRET)
    tampered = json.dumps({"type": "checkout.session.completed", "amt": 999999}).encode()
    assert svc.verify_webhook_signature(tampered, sig) is False


def test_unconfigured_secret_fails_closed():
    """No secret configured -> validator must refuse, not silently accept."""
    service = StripeService()
    service.webhook_secret = None
    payload = b'{"type":"checkout.session.completed"}'
    assert service.verify_webhook_signature(payload, "t=1,v1=abc") is False


# --------------------------------------------------------------------------
# Endpoint-level fail-closed behaviour
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_endpoint_rejects_invalid_signature(monkeypatch):
    """With a secret configured, a bad signature must 400 before any handling."""
    monkeypatch.setattr(
        payments_module.stripe_service, "webhook_secret", WEBHOOK_SECRET
    )
    # If signature validation were bypassed, this would reach the handler.
    monkeypatch.setattr(
        payments_module.stripe_service,
        "handle_webhook_event",
        _fail_if_called,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://verify") as ac:
        resp = await ac.post(
            "/api/payments/webhook/stripe",
            content=b'{"type":"checkout.session.completed"}',
            headers={"stripe-signature": "t=1,v1=deadbeef"},
        )
    assert resp.status_code == 400
    assert "signature" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_endpoint_accepts_valid_signature(monkeypatch):
    monkeypatch.setattr(
        payments_module.stripe_service, "webhook_secret", WEBHOOK_SECRET
    )

    async def _ok(event_type, event_data):
        return {"status": "ignored", "event_type": event_type}

    monkeypatch.setattr(
        payments_module.stripe_service, "handle_webhook_event", _ok
    )

    payload = json.dumps({"type": "ping"}).encode()
    sig = _sign(payload, WEBHOOK_SECRET)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://verify") as ac:
        resp = await ac.post(
            "/api/payments/webhook/stripe",
            content=payload,
            headers={"stripe-signature": sig},
        )
    assert resp.status_code == 200


async def _fail_if_called(*args, **kwargs):  # pragma: no cover - must never run
    raise AssertionError(
        "handle_webhook_event ran despite an invalid signature — "
        "the endpoint is NOT fail-closed."
    )
