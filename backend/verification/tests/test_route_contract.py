"""
Route Contract Verification  (audit issue #4)
=============================================

The audit's objection: "Integration tests assume routes exist."  An integration
suite that POSTs to ``/api/clients`` proves nothing if ``/api/clients`` was never
registered — it just 404s, and a sloppy harness reads that as "endpoint
responded."  So before any behavioural test runs, we assert the *contract*: every
route the verification framework depends on is actually mounted on the ASGI app.

This turns "the suite references these routes" (not evidence) into "these routes
are registered and addressable" (evidence). It deliberately introspects the live
``app.routes`` table rather than trusting a hand-written list.

It also asserts we do NOT advertise routes that don't exist — specifically the
audit-flagged ``/api/payments/test`` (issue #2), which was never implemented and
must not be referenced by any verification step.
"""

from __future__ import annotations

import pytest

from backend.main import app


def _registered_routes() -> set[tuple[str, str]]:
    """Return the set of (METHOD, PATH) pairs registered on the app."""
    pairs: set[tuple[str, str]] = set()
    for route in app.routes:
        methods = getattr(route, "methods", None) or set()
        path = getattr(route, "path", None)
        if not path:
            continue
        for method in methods:
            pairs.add((method.upper(), path))
    return pairs


# Routes the verification framework and dashboards actually depend on. Every one
# of these is checked against the live router. If a route is renamed or dropped,
# this test fails loudly instead of a downstream test silently 404ing.
REQUIRED_ROUTES: list[tuple[str, str]] = [
    ("GET", "/api/health"),
    ("GET", "/api/health/features"),
    ("GET", "/api/health/secrets"),
    ("GET", "/api/payments"),
    ("GET", "/api/payments/{payment_id}"),
    ("POST", "/api/payments/checkout/deposit"),
    ("POST", "/api/payments/checkout/progress"),
    ("POST", "/api/payments/checkout/change-order"),
    ("POST", "/api/payments/webhook/stripe"),
    ("GET", "/api/leads"),
    ("GET", "/api/projects"),
    ("GET", "/api/jobs"),
    ("GET", "/api/estimates"),
    ("GET", "/api/invoices"),
]

# Routes the audit template assumed but which DO NOT exist in this stack. We
# assert their absence so no verification step is written against a phantom.
PHANTOM_ROUTES: list[tuple[str, str]] = [
    ("POST", "/api/payments/test"),
]


@pytest.mark.parametrize("method,path", REQUIRED_ROUTES)
def test_required_route_is_registered(method: str, path: str) -> None:
    registered = _registered_routes()
    assert (method, path) in registered, (
        f"Required route {method} {path} is not registered on the app. "
        f"Verification steps targeting it would 404 and prove nothing."
    )


@pytest.mark.parametrize("method,path", PHANTOM_ROUTES)
def test_phantom_route_is_absent(method: str, path: str) -> None:
    registered = _registered_routes()
    assert (method, path) not in registered, (
        f"Phantom route {method} {path} unexpectedly exists. Update the audit "
        f"response — verification may now target the real endpoint."
    )


def test_no_route_path_collisions() -> None:
    """Two handlers on the same (method, path) is a registration bug."""
    seen: dict[tuple[str, str], int] = {}
    for route in app.routes:
        methods = getattr(route, "methods", None) or set()
        path = getattr(route, "path", None)
        if not path:
            continue
        for method in methods:
            key = (method.upper(), path)
            seen[key] = seen.get(key, 0) + 1
    collisions = {k: v for k, v in seen.items() if v > 1}
    assert not collisions, f"Route collisions detected: {collisions}"
