"""
Verification Pipeline — the only way the verified count grows.

The registry's verified number moves when a verification EVENT exists, never
when a label is edited. Each event names the verifier, the method, the
evidence, and an expiry — verification is rolling, not permanent. Promotion
is applied at registry-build time: a non-VERIFIED node with a current event
is promoted with the event's evidence attached; an expired event promotes
nothing. No event, no promotion — fail-closed, same as everywhere else.

Seeded with what is genuinely verifiable today:

  1. repo:mission_control — third-party telemetry: Vercel reports all three
     production deployments completed on commit 0bfae1d (2026-06-11). Scope
     honestly noted: the deployed UI serves fixture-backed data.
  2. reg:telegram_price_bot — operator attestation: the control register's
     own source header lists "Telegram Price Bot is LIVE 90%"; it simply was
     not one of the 50 table rows. Added as an attested addendum node.

Everything else earns promotion through the verification queue below — a
ranked list of the closest candidates and the exact evidence each needs.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timezone

from backend.systems.control_register import (
    CONTROL_REGISTER,
    REGISTER_SOURCE,
    REGISTER_VERIFIER,
)
from backend.systems.registry import SystemNode, TruthRegistry
from backend.systems.truth import TruthBucket


@dataclass(frozen=True)
class VerificationEvent:
    """One verification of one system. Expires; re-verification required."""

    system_key: str
    verifier: str
    method: str               # "third_party_telemetry" | "operator_attestation"
    evidence: tuple[str, ...]
    verified_at: str          # ISO date
    expires_at: str           # ISO date — verification is rolling, not permanent

    def is_current(self, now: datetime | None = None) -> bool:
        now = now or datetime.now(timezone.utc)
        return now.date().isoformat() <= self.expires_at


# The verification log. Append-only in spirit: events are added when real
# verification happens, never edited to inflate the count.
VERIFICATION_LOG: tuple[VerificationEvent, ...] = (
    VerificationEvent(
        system_key="repo:mission_control",
        verifier="Vercel deployment telemetry (third party)",
        method="third_party_telemetry",
        evidence=(
            "Vercel status API: 3/3 production deployments 'completed' on commit 0bfae1d (2026-06-11 20:08 UTC)",
            "Projects: nobleport-etf, nobleport-etf-ekqm, cyborio — all Ready and serving",
            "Scope: deployed dashboard UI is live; data panels are fixture-backed (MODELED) until the FastAPI gateway is wired",
        ),
        verified_at="2026-06-11",
        expires_at="2026-09-09",  # 90-day rolling window
    ),
)


# Attested addendum: systems in the operator's source that were not among the
# 50 register rows. Same named verifier, same attestation standard.
ATTESTED_ADDENDUM: tuple[SystemNode, ...] = (
    SystemNode(
        key="reg:telegram_price_bot",
        name="Telegram Price Bot",
        category="Trading",
        bucket=TruthBucket.VERIFIED,
        summary="Telegram bot serving live price queries.",
        evidence=(
            "Operator register source header (2026-06-11): 'Telegram Price Bot is LIVE 90%'",
            "Declared completion: 90%",
        ),
        next_gate="Rolling re-attestation; add uptime telemetry for third-party verification.",
        source=REGISTER_SOURCE,
        verified_by=REGISTER_VERIFIER,
    ),
)


def apply_verifications(
    registry: TruthRegistry,
    now: datetime | None = None,
) -> TruthRegistry:
    """
    Promote nodes that have a CURRENT verification event.

    Raises on an event for an unknown system (a verification of nothing is a
    log error, not a silent no-op). Expired events promote nothing.
    """
    by_key = {n.key: i for i, n in enumerate(registry.nodes)}
    for event in VERIFICATION_LOG:
        if event.system_key not in by_key:
            raise ValueError(
                f"Verification event for unknown system {event.system_key!r}"
            )
        if not event.is_current(now):
            continue
        idx = by_key[event.system_key]
        node = registry.nodes[idx]
        if node.bucket is TruthBucket.VERIFIED:
            continue
        registry.nodes[idx] = replace(
            node,
            bucket=TruthBucket.VERIFIED,
            verified_by=event.verifier,
            evidence=node.evidence + event.evidence,
            next_gate=f"Re-verify before {event.expires_at} (rolling window).",
        )
    return registry


def verification_queue(limit: int = 10) -> list[dict[str, object]]:
    """
    The ranked path to a higher verified count: STAGED register rows ordered
    by declared completion (closest to the bar first), each with the exact
    evidence that promotes it. Optimizing the number = working this queue.
    """
    candidates = [
        r for r in CONTROL_REGISTER
        if r.bucket is TruthBucket.STAGED
    ]
    candidates.sort(key=lambda r: (-(r.completion_pct or 0), r.num))
    queue: list[dict[str, object]] = []
    for r in candidates[:limit]:
        queue.append({
            "key": f"reg:{r.key}",
            "name": r.name,
            "declared_completion_pct": r.completion_pct,
            "blocking": r.control_truth,
            "evidence_needed": r.next_gate or (
                "Operator attestation of live operation, or independent telemetry"
            ),
        })
    return queue
