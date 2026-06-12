"""
MCP Gateway — Auth stage.

Verifies a bearer token into a Principal: subject, granted scopes, expiry.
Tokens are HMAC-SHA256 signed over canonical claims with a server secret —
real signature + expiry verification, fail-closed on a bad signature, a missing
claim, or an expired token.

Honest truth label, matching the uploaded gateway's gap: this is shared-secret
HMAC, not OIDC/JWKS with audience validation. Real identity-provider key
rotation (JWKS) is the production gate. The verification *logic* here — sign,
check, expire, fail-closed — is what production keeps; only the key source
changes.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass

# Dev/test signing secret. In production this is replaced by JWKS public-key
# verification; the gateway refuses to start LIVE with this placeholder.
_DEV_SECRET = b"nobleport-gateway-dev-secret-not-for-production"


class AuthError(Exception):
    """Token failed verification — fail-closed, never a soft pass."""


@dataclass(frozen=True)
class Principal:
    subject: str
    scopes: frozenset[str]
    expires_at: int  # unix seconds
    roles: frozenset[str] = frozenset()

    def is_expired(self, now: int | None = None) -> bool:
        return (now or int(time.time())) >= self.expires_at


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _b64u_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _sign(payload_b64: str, secret: bytes) -> str:
    return _b64u(hmac.new(secret, payload_b64.encode(), hashlib.sha256).digest())


def mint_token(
    subject: str,
    scopes: list[str],
    *,
    ttl_seconds: int = 900,
    roles: list[str] | None = None,
    secret: bytes = _DEV_SECRET,
    now: int | None = None,
) -> str:
    """Issue a signed token (test/dev helper; prod tokens come from the IdP)."""
    now = now or int(time.time())
    claims = {
        "sub": subject,
        "scopes": sorted(scopes),
        "roles": sorted(roles or []),
        "exp": now + ttl_seconds,
    }
    payload_b64 = _b64u(json.dumps(claims, sort_keys=True).encode())
    return f"{payload_b64}.{_sign(payload_b64, secret)}"


def authenticate(token: str, *, secret: bytes = _DEV_SECRET, now: int | None = None) -> Principal:
    """
    Verify a token and return its Principal. Fail-closed on any defect.
    """
    if not token or token.count(".") != 1:
        raise AuthError("malformed token")
    payload_b64, sig = token.split(".", 1)
    expected = _sign(payload_b64, secret)
    if not hmac.compare_digest(sig, expected):
        raise AuthError("bad signature")
    try:
        claims = json.loads(_b64u_decode(payload_b64))
    except (ValueError, json.JSONDecodeError) as exc:
        raise AuthError("undecodable claims") from exc
    for field in ("sub", "scopes", "exp"):
        if field not in claims:
            raise AuthError(f"missing claim {field!r}")
    principal = Principal(
        subject=str(claims["sub"]),
        scopes=frozenset(claims["scopes"]),
        roles=frozenset(claims.get("roles", [])),
        expires_at=int(claims["exp"]),
    )
    if principal.is_expired(now):
        raise AuthError("token expired")
    return principal
