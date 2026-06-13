"""
The hard wall: payment node ⟂ token / liquidity layer.

The construction payment node moves real customer deposits — consumer funds
protected under MA c.142A. The NBPT / KUZO / liquidity layer can pull the
business into securities and money-transmitter (FinCEN/MSB) territory. Those two
worlds must never share a code path: customer deposits should never be reachable
from wallet sync, liquidity routing, or token swaps, and not even a human
clicking "approve" should be able to bridge them inside this process.

These tests make that wall enforceable instead of aspirational:

  * Static import guard — the payment-node modules may not import any
    crypto / token / bridge / trading / web3 module (AST, no execution needed).
  * Symbol guard — payment-node source may not even reference wallet / liquidity
    / swap / treasury / stablecoin vocabulary.
  * Live pre-flight guard — settings refuse to boot in live payment mode unless
    the go-live controls are satisfied (live key, webhook secret, durable
    Postgres ledger, https return URLs).
  * Webhook guard — raw-body signature verification rejects forgeries and
    stale (replayed) timestamps.

If a future change tries to wire the payment node to the token side, CI fails
here first.
"""

from __future__ import annotations

import ast
import hashlib
import hmac
import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from backend.config.settings import Settings, StripeMode
from backend.services.stripe_service import StripeService

REPO_ROOT = Path(__file__).resolve().parents[2]

# The modules that constitute the payment node. Nothing here may touch crypto.
PAYMENT_NODE_FILES = [
    REPO_ROOT / "backend" / "services" / "stripe_service.py",
    REPO_ROOT / "backend" / "api" / "payments.py",
    REPO_ROOT / "backend" / "models" / "payment.py",
]

# Top-level packages that belong exclusively to the token / liquidity world.
FORBIDDEN_IMPORT_ROOTS = {
    "web3",
    "eth_account",
    "eth_keys",
    "eth_utils",
    "eth_typing",
    "ethers",
    "solcx",
    "brownie",
    "ape",
}

# Dotted in-repo module prefixes on the crypto/token side of the wall.
FORBIDDEN_IMPORT_PREFIXES = (
    "backend.services.nobleport_bridge",
    "backend.trading",
    "src.lib.nemoclaw",
    "nemoclaw",
)

# Vocabulary that should never appear in payment-node source. Word-boundary
# matched so brand strings like "NoblePort" are unaffected.
FORBIDDEN_SYMBOLS = (
    "wallet",
    "liquidity",
    "stablecoin",
    "treasury",
    "signer_gateway",
    "signergateway",
    "dex_router",
    "vault",
    "web3",
)
# "swap" only as a token operation, not the English word ("swap point"/"swap in").
FORBIDDEN_PATTERNS = (
    re.compile(r"\b(?:dex[_\s-]?swap|token[_\s-]?swap|swap_tokens|swapExact)\b", re.IGNORECASE),
)


def _imported_module_names(source: str) -> list[str]:
    """Every dotted module name pulled in by `import` / `from ... import`."""
    tree = ast.parse(source)
    names: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            if node.level and node.level > 0:
                # Relative import — resolve only the explicit module tail.
                if node.module:
                    names.append(node.module)
            elif node.module:
                names.append(node.module)
    return names


@pytest.mark.parametrize("path", PAYMENT_NODE_FILES, ids=lambda p: p.name)
def test_payment_node_imports_nothing_from_token_layer(path: Path):
    assert path.exists(), f"payment-node file missing: {path}"
    source = path.read_text(encoding="utf-8")

    for module in _imported_module_names(source):
        root = module.split(".")[0]
        assert root not in FORBIDDEN_IMPORT_ROOTS, (
            f"{path.name} imports crypto package '{module}': the payment node "
            f"must contain zero code paths to the token/liquidity layer."
        )
        for prefix in FORBIDDEN_IMPORT_PREFIXES:
            assert not module.startswith(prefix), (
                f"{path.name} imports '{module}' from the token layer: "
                f"the payment node and token layer must stay fully walled off."
            )


@pytest.mark.parametrize("path", PAYMENT_NODE_FILES, ids=lambda p: p.name)
def test_payment_node_source_has_no_token_vocabulary(path: Path):
    source = path.read_text(encoding="utf-8")
    for symbol in FORBIDDEN_SYMBOLS:
        match = re.search(rf"\b{re.escape(symbol)}\b", source, re.IGNORECASE)
        assert match is None, (
            f"{path.name} references token-layer concept '{symbol}'. "
            f"Customer deposits must not be coupled to wallet/liquidity logic."
        )
    for pattern in FORBIDDEN_PATTERNS:
        assert pattern.search(source) is None, (
            f"{path.name} references a token-swap operation; "
            f"swaps must live entirely on the other side of the wall."
        )


# ---------------------------------------------------------------------------
# Live pre-flight gate — settings fail closed in live payment mode.
# ---------------------------------------------------------------------------

_SAFE_LIVE_CONFIG = dict(
    stripe_mode=StripeMode.LIVE,
    stripe_secret_key="sk_live_realkeyvalue123",
    stripe_webhook_secret="whsec_realsecret",
    database_url="postgresql+asyncpg://user:pw@db/nobleport",
    stripe_success_url="https://pay.nobleport.com/success",
    stripe_cancel_url="https://pay.nobleport.com/cancel",
)


def test_test_mode_settings_construct_with_defaults():
    s = Settings(stripe_mode=StripeMode.TEST)
    assert s.is_live_payments is False


def test_fully_configured_live_settings_are_allowed():
    s = Settings(**_SAFE_LIVE_CONFIG)
    assert s.is_live_payments is True
    assert s.has_durable_ledger is True


@pytest.mark.parametrize(
    "override, needle",
    [
        ({"stripe_secret_key": None}, "stripe_secret_key is not set"),
        ({"stripe_secret_key": "sk_test_123"}, "not a live key"),
        ({"stripe_webhook_secret": None}, "stripe_webhook_secret is not set"),
        ({"database_url": "sqlite+aiosqlite:///./nobleport.db", "postgres_url": None}, "durable Postgres ledger"),
        ({"stripe_success_url": "http://localhost:3000/s"}, "must be https"),
    ],
)
def test_live_mode_fails_closed_on_missing_control(override, needle):
    config = {**_SAFE_LIVE_CONFIG, **override}
    with pytest.raises(ValidationError) as excinfo:
        Settings(**config)
    assert needle in str(excinfo.value)


# ---------------------------------------------------------------------------
# Webhook guard — raw-body signature verification + replay protection.
# ---------------------------------------------------------------------------

def _sign(secret: str, payload: bytes, timestamp: int) -> str:
    signed = b"%b.%b" % (str(timestamp).encode(), payload)
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def _service_with_secret(secret: str = "whsec_test_secret") -> StripeService:
    svc = StripeService()
    svc.webhook_secret = secret
    svc.webhook_tolerance_seconds = 300
    return svc


def test_webhook_accepts_valid_signature():
    svc = _service_with_secret()
    payload = b'{"type":"checkout.session.completed"}'
    now = 1_700_000_000
    sig = _sign(svc.webhook_secret, payload, now)
    assert svc.verify_webhook_signature(payload, sig, now=now) is True


def test_webhook_rejects_tampered_payload():
    svc = _service_with_secret()
    now = 1_700_000_000
    sig = _sign(svc.webhook_secret, b'{"amount":100}', now)
    forged = b'{"amount":1000000}'
    assert svc.verify_webhook_signature(forged, sig, now=now) is False


def test_webhook_rejects_stale_timestamp_replay():
    svc = _service_with_secret()
    payload = b'{"type":"checkout.session.completed"}'
    signed_at = 1_700_000_000
    sig = _sign(svc.webhook_secret, payload, signed_at)
    # Same valid signature, but replayed an hour later -> outside tolerance.
    assert svc.verify_webhook_signature(payload, sig, now=signed_at + 3600) is False


def test_webhook_rejects_when_no_secret_configured():
    svc = StripeService()
    svc.webhook_secret = None
    payload = b"{}"
    assert svc.verify_webhook_signature(payload, "t=1,v1=deadbeef", now=1) is False


def test_webhook_rejects_empty_signature():
    svc = _service_with_secret()
    assert svc.verify_webhook_signature(b"{}", "", now=1) is False
