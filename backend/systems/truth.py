"""
NoblePort Systems — Truth Buckets & Verification Gates

The taxonomy for classifying every NoblePort system/module by the *provenance
of its operational status*. A self-declared status file saying "mesh launched,
1,000 validators" is a claim, not proof; a demo that generated 2M random avatar
IDs is a simulation, not a fleet. The buckets make that distinction structural:

    VERIFIED    Independently verified live production. Requires a named
                verifier — the code refuses VERIFIED without one (fail-closed).
    STAGED      Built and measurable (code + tests on disk) but not verified
                live in production.
    CLAIMED     Self-declared status with no independent evidence.
    DEMO        Simulation / demonstration output. Explicitly not production.
    PLANNED     Roadmap / backlog. Not built.
    BLOCKED     Not permitted to operate (e.g. execution-restricted lanes).
    LEGAL_HOLD  Gated on legal/compliance signoff before any operation.
    REFERENCE   External artifact or dataset referenced but not yet ingested.

Each bucket carries its promotion gate: the concrete evidence required to move
a node up. Promotion is evidence-first, never calendar- or assertion-based —
the same capture-first principle as the sales provenance layer.
"""

from __future__ import annotations

from enum import Enum


class TruthBucket(str, Enum):
    VERIFIED = "verified"
    STAGED = "staged"
    CLAIMED = "claimed"
    DEMO = "demo"
    PLANNED = "planned"
    BLOCKED = "blocked"
    LEGAL_HOLD = "legal_hold"
    REFERENCE = "reference"


# Human-readable definition per bucket — the single source for API/dashboard.
BUCKET_DEFINITIONS: dict[TruthBucket, str] = {
    TruthBucket.VERIFIED: (
        "Verified live by a named, accountable verifier — operator attestation "
        "or independent telemetry. Never self-declared by the system itself."
    ),
    TruthBucket.STAGED: (
        "Built and measurable — code, tests, and docs exist on disk — but not "
        "verified live in production."
    ),
    TruthBucket.CLAIMED: (
        "Self-declared status (e.g. a project's own status file). No independent "
        "telemetry or third-party evidence."
    ),
    TruthBucket.DEMO: (
        "Simulation or demonstration output. Explicitly not production; safe for "
        "training, forecasting, and scenario planning."
    ),
    TruthBucket.PLANNED: "Roadmap / backlog. Not built yet.",
    TruthBucket.BLOCKED: (
        "Not permitted to operate — fail-closed (e.g. execution-restricted lanes, "
        "unresolved governance blocks)."
    ),
    TruthBucket.LEGAL_HOLD: (
        "Operation gated on legal/compliance signoff (regulated securities, "
        "licensed-professional domains). Human approval mandatory."
    ),
    TruthBucket.REFERENCE: (
        "External artifact or dataset referenced by the program but not yet "
        "ingested into the repository."
    ),
}

# What it takes to promote a node OUT of each bucket (toward VERIFIED).
PROMOTION_GATES: dict[TruthBucket, str] = {
    TruthBucket.VERIFIED: "Re-verify on a rolling basis; verification evidence expires.",
    TruthBucket.STAGED: "Deploy to production and capture independent live telemetry.",
    TruthBucket.CLAIMED: (
        "Obtain independent telemetry or third-party attestation; a self-declared "
        "status file can never promote itself."
    ),
    TruthBucket.DEMO: (
        "Replace generated/demo data with real production records (real IDs, real "
        "transactions), then verify."
    ),
    TruthBucket.PLANNED: "Build it: code + tests + docs on disk moves it to STAGED.",
    TruthBucket.BLOCKED: "Resolve the governing block via the authority matrix; human signoff.",
    TruthBucket.LEGAL_HOLD: "Written legal/compliance signoff from licensed counsel.",
    TruthBucket.REFERENCE: "Ingest the artifact into the repo so it becomes measurable.",
}

# Buckets whose nodes may take real-world action without further human gates.
# Deliberately VERIFIED-only — everything else is informational or gated.
OPERATIONAL_BUCKETS: frozenset[TruthBucket] = frozenset({TruthBucket.VERIFIED})

# Buckets that must never be presented as live production capability.
NON_PRODUCTION_BUCKETS: frozenset[TruthBucket] = frozenset({
    TruthBucket.CLAIMED,
    TruthBucket.DEMO,
    TruthBucket.PLANNED,
    TruthBucket.BLOCKED,
    TruthBucket.LEGAL_HOLD,
    TruthBucket.REFERENCE,
})
