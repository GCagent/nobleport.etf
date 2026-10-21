"""
NoblePort App Audit Framework
=============================

A *per-app* "truth score" for every NoblePort surface, built on the exact same
honesty discipline the rest of this package already enforces:

  >>> Design/build maturity and runtime evidence are DIFFERENT axes and are
  >>> never conflated. A 95%-built UI proves nothing about what is LIVE.

Where ``verification/truth_label.py`` answers *"is the whole backend a
production candidate?"*, this module answers the audit's question — *"for each
app we show customers, partners, investors and municipalities, what is actually
verified vs. aspirational?"* — and produces an objective scorecard instead of
marketing language.

Two independent things are reported for every app:

  1. SIX DIMENSION SCORES (0-100%)   -- Frontend/UI, Backend/API, Database,
                                         AI Integration, Security, Production
                                         Readiness. Hand-scored build maturity.
                                         These describe how much is *built*.
                                         They can NEVER promote an app's
                                         evidence label.

  2. EVIDENCE LEVEL  (the gate)      -- one of:
        🟢 VERIFIED_LIVE  confirmed by on-chain data, APIs, production DBs,
                          or real customer activity
        🟡 STAGING        built & functional in a test environment;
                          not yet production-verified
        🔵 PROTOTYPE      UI/workflow demonstration with placeholder or
                          simulated data
        🔴 PLANNED        architecture or roadmap only; not yet implemented

The load-bearing honesty rule, enforced mechanically (see
``check_consistency``): **an app may be labelled 🟢 VERIFIED_LIVE only if it is
backed by at least one capability that ``operational_truth.py`` independently
classifies as LIVE.** No dimension score — not even a 100% frontend — can buy a
Verified Live label. This is the per-app twin of the truth_label rule that
"design maturity can never move STATUS."

Run:
    python -m backend.verification.app_audit                 # scorecard
    python -m backend.verification.app_audit --json          # machine output
    python -m backend.verification.app_audit --app "Stephanie.ai"
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

try:  # package-relative when imported as backend.verification.app_audit
    from backend.config.operational_truth import (
        DeploymentStatus,
        OPERATIONAL_TRUTH,
    )
except ImportError:  # pragma: no cover - allow running file directly
    import os

    sys.path.insert(
        0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    )
    from backend.config.operational_truth import (  # type: ignore
        DeploymentStatus,
        OPERATIONAL_TRUTH,
    )


class EvidenceLevel(str, Enum):
    """The audit's four evidence categories, most-proven first."""

    VERIFIED_LIVE = "VERIFIED_LIVE"  # 🟢
    STAGING = "STAGING"              # 🟡
    PROTOTYPE = "PROTOTYPE"          # 🔵
    PLANNED = "PLANNED"              # 🔴


# Display + ordering metadata. Higher rank == more proven.
_LEVEL_META: dict[EvidenceLevel, dict[str, Any]] = {
    EvidenceLevel.VERIFIED_LIVE: {"badge": "🟢", "rank": 3, "label": "Verified Live"},
    EvidenceLevel.STAGING: {"badge": "🟡", "rank": 2, "label": "Staging"},
    EvidenceLevel.PROTOTYPE: {"badge": "🔵", "rank": 1, "label": "Prototype"},
    EvidenceLevel.PLANNED: {"badge": "🔴", "rank": 0, "label": "Planned"},
}

# How a verified operational-truth status maps onto the audit's evidence ceiling.
# An app can never claim MORE evidence than its strongest LIVE capability earns.
_STATUS_TO_LEVEL: dict[DeploymentStatus, EvidenceLevel] = {
    DeploymentStatus.LIVE: EvidenceLevel.VERIFIED_LIVE,
    DeploymentStatus.STAGED: EvidenceLevel.STAGING,
    DeploymentStatus.MODELED: EvidenceLevel.PROTOTYPE,
    DeploymentStatus.INTERNAL_RD: EvidenceLevel.PLANNED,
}

# The six audit dimensions, in display order.
DIMENSIONS: tuple[str, ...] = (
    "frontend_ui",
    "backend_api",
    "database",
    "ai_integration",
    "security",
    "production_readiness",
)

_DIMENSION_LABELS: dict[str, str] = {
    "frontend_ui": "Frontend / UI",
    "backend_api": "Backend / API",
    "database": "Database",
    "ai_integration": "AI Integration",
    "security": "Security",
    "production_readiness": "Production Readiness",
}


@dataclass
class AppAudit:
    """One NoblePort app/surface and its audited scores.

    ``backing_live_features`` lists ``operational_truth`` keys this app depends on
    that are independently classified LIVE. It is what authorizes (or refuses) a
    VERIFIED_LIVE evidence level — it is never hand-asserted alongside the label.
    """

    name: str
    surface: str
    evidence_level: EvidenceLevel
    # operational_truth keys this app is built on (any status).
    truth_features: list[str]
    # subset of truth_features the app *requires* to be LIVE to be Verified Live.
    backing_live_features: list[str]
    # 0-100 build-maturity scores per dimension.
    scores: dict[str, int]
    note: str = ""

    def design_score(self) -> int:
        """Mean of the six dimension scores — the build-maturity axis only."""
        vals = [self.scores.get(d, 0) for d in DIMENSIONS]
        return round(sum(vals) / len(DIMENSIONS))


# ---------------------------------------------------------------------------
# The NoblePort app registry.
#
# Scores are conservative, hand-set build-maturity estimates. Evidence levels are
# disciplined by operational_truth: every VERIFIED_LIVE app names the LIVE
# capability that earns it (verified by check_consistency below). Production
# Readiness is deliberately held below the build scores for anything not yet
# Verified Live — "built" is not "proven in production."
# ---------------------------------------------------------------------------
def _registry() -> list[AppAudit]:
    return [
        AppAudit(
            name="Stephanie.ai",
            surface="Stephanie.ai",
            evidence_level=EvidenceLevel.VERIFIED_LIVE,
            truth_features=[
                "voice_intake",
                "lead_pipeline",
                "estimate_generation",
                "calendar_scheduling",
                "revenue_operator",
            ],
            backing_live_features=[
                "voice_intake",
                "lead_pipeline",
                "estimate_generation",
            ],
            scores={
                "frontend_ui": 90,
                "backend_api": 85,
                "database": 80,
                "ai_integration": 88,
                "security": 78,
                "production_readiness": 80,
            },
            note="Live voice intake + lead/estimate pipeline. Scheduling and the "
            "revenue-operator layer are Staging, not yet production-verified.",
        ),
        AppAudit(
            name="GCagent.ai",
            surface="GCagent.ai",
            evidence_level=EvidenceLevel.VERIFIED_LIVE,
            truth_features=["crew_task_routing", "job_cost_forecasting"],
            backing_live_features=["crew_task_routing"],
            scores={
                "frontend_ui": 75,
                "backend_api": 82,
                "database": 80,
                "ai_integration": 80,
                "security": 76,
                "production_readiness": 72,
            },
            note="Crew/sub task routing is live. Job-cost forecasting is a "
            "Modeled (Prototype) layer, not yet evidenced against real jobs.",
        ),
        AppAudit(
            name="Mission Control",
            surface="Frontend",
            evidence_level=EvidenceLevel.VERIFIED_LIVE,
            truth_features=["dashboard_kpis"],
            backing_live_features=["dashboard_kpis"],
            scores={
                "frontend_ui": 95,
                "backend_api": 80,
                "database": 78,
                "ai_integration": 60,
                "security": 75,
                "production_readiness": 80,
            },
            note="KPI tiles and pipeline funnel render live pipeline data. AI "
            "integration is intentionally thin on this surface.",
        ),
        AppAudit(
            name="NoblePort Payment Node",
            surface="Backend",
            evidence_level=EvidenceLevel.STAGING,
            truth_features=["treasury_workflows", "hubspot_sync"],
            backing_live_features=[],
            scores={
                "frontend_ui": 80,
                "backend_api": 85,
                "database": 82,
                "ai_integration": 40,
                "security": 88,
                "production_readiness": 60,
            },
            note="Stripe invoicing/deposit logging built and human-gated; "
            "Staging until the live Stripe-sandbox evidence artifact is collected "
            "(see truth_label gating set). Every money move is human-authorized.",
        ),
        AppAudit(
            name="PermitStream.ai",
            surface="PermitStream.ai",
            evidence_level=EvidenceLevel.STAGING,
            truth_features=["permit_scraping", "permit_forecast"],
            backing_live_features=[],
            scores={
                "frontend_ui": 78,
                "backend_api": 75,
                "database": 76,
                "ai_integration": 65,
                "security": 70,
                "production_readiness": 55,
            },
            note="MA permit scraping is built and functional in test; geo-limited "
            "to Massachusetts. AHJ forecast model is a Prototype layer on top.",
        ),
        AppAudit(
            name="Cyborg.ai Compliance Engine",
            surface="Cyborg.ai",
            evidence_level=EvidenceLevel.PROTOTYPE,
            truth_features=["compliance_engine"],
            backing_live_features=[],
            scores={
                "frontend_ui": 55,
                "backend_api": 60,
                "database": 55,
                "ai_integration": 70,
                "security": 80,
                "production_readiness": 35,
            },
            note="Policy enforcement / kill-switch / audit-chain modeled with "
            "simulated policy inputs. Strong security design intent, unproven at "
            "runtime.",
        ),
        AppAudit(
            name="Agent Mesh Orchestrator",
            surface="Orchestrator",
            evidence_level=EvidenceLevel.PROTOTYPE,
            truth_features=["agent_mesh"],
            backing_live_features=[],
            scores={
                "frontend_ui": 50,
                "backend_api": 65,
                "database": 55,
                "ai_integration": 75,
                "security": 65,
                "production_readiness": 35,
            },
            note="Multi-agent health/mesh coordination demonstrated with "
            "simulated agent telemetry; not yet wired to live mesh metrics.",
        ),
        AppAudit(
            name="NobleNest",
            surface="Homeowner Platform",
            evidence_level=EvidenceLevel.PROTOTYPE,
            truth_features=[],
            backing_live_features=[],
            scores={
                "frontend_ui": 70,
                "backend_api": 45,
                "database": 50,
                "ai_integration": 50,
                "security": 55,
                "production_readiness": 35,
            },
            note="Homeowner maintenance/customer layer is a UI/workflow demo; no "
            "operational-truth capability is LIVE for it yet.",
        ),
        AppAudit(
            name="Web3 / Tokenization Dashboard",
            surface="Contracts",
            evidence_level=EvidenceLevel.PROTOTYPE,
            truth_features=["erc1400_tokenization", "dao_governance"],
            backing_live_features=[],
            scores={
                "frontend_ui": 95,
                "backend_api": 25,
                "database": 30,
                "ai_integration": 30,
                # No live chain reads/writes -> production readiness capped low.
                "security": 50,
                "production_readiness": 40,
            },
            note="Polished UI over SIMULATED / unverified metrics. Live "
            "blockchain verification: 0% — no on-chain reads or writes are "
            "confirmed. Underlying ERC-1400 / DAO contracts are Internal R&D "
            "(Planned). Matches the audit's example scoring exactly.",
        ),
        AppAudit(
            name="ERC-1400 Tokenization & SSI Identity",
            surface="Contracts / Identity",
            evidence_level=EvidenceLevel.PLANNED,
            truth_features=["erc1400_tokenization", "ssi_identity", "dao_governance"],
            backing_live_features=[],
            scores={
                "frontend_ui": 20,
                "backend_api": 30,
                "database": 20,
                "ai_integration": 10,
                "security": 60,
                "production_readiness": 15,
            },
            note="Security-token issuance + DID/ENS identity exist as Solidity "
            "contracts and architecture only (Internal R&D). No deployed, "
            "verified chain integration.",
        ),
    ]


# ---------------------------------------------------------------------------
# Consistency tripwire — the honesty gate.
# ---------------------------------------------------------------------------
def check_consistency(apps: list[AppAudit] | None = None) -> list[str]:
    """Return a list of honesty violations. Empty list == clean.

    Enforced rules:
      1. A VERIFIED_LIVE app MUST name >=1 backing feature that operational_truth
         independently classifies LIVE. (No score can buy Verified Live.)
      2. Every named backing_live_feature must actually exist in operational_truth
         and actually be LIVE there.
      3. An app's evidence level may not exceed the ceiling its *strongest* named
         truth_feature earns (a Staging-only stack can't be flagged Verified Live).
      4. Scores are within 0-100 and Production Readiness for a non-Verified_Live
         app stays <= 60 ("built" is not "production-proven").
    """
    apps = apps if apps is not None else _registry()
    problems: list[str] = []

    for app in apps:
        live_backing = [
            f
            for f in app.backing_live_features
            if OPERATIONAL_TRUTH.get(f, {}).get("status") == DeploymentStatus.LIVE
        ]

        # Rule 2 — named backing features must exist and be LIVE.
        for f in app.backing_live_features:
            entry = OPERATIONAL_TRUTH.get(f)
            if entry is None:
                problems.append(
                    f"{app.name}: backing feature '{f}' is not in operational_truth"
                )
            elif entry["status"] != DeploymentStatus.LIVE:
                problems.append(
                    f"{app.name}: backing feature '{f}' is "
                    f"{entry['status'].value}, not LIVE — cannot back a "
                    f"Verified Live claim"
                )

        # Rule 1 — Verified Live requires real LIVE backing.
        if app.evidence_level == EvidenceLevel.VERIFIED_LIVE and not live_backing:
            problems.append(
                f"{app.name}: labelled VERIFIED_LIVE but has no LIVE-classified "
                f"backing capability in operational_truth — scores cannot promote "
                f"an app to Verified Live"
            )

        # Rule 3 — evidence level may not exceed the ceiling its truth features earn.
        if app.truth_features:
            ceiling = max(
                (
                    _STATUS_TO_LEVEL[OPERATIONAL_TRUTH[f]["status"]]
                    for f in app.truth_features
                    if f in OPERATIONAL_TRUTH
                ),
                key=lambda lvl: _LEVEL_META[lvl]["rank"],
                default=EvidenceLevel.PLANNED,
            )
            # A built UI legitimately earns PROTOTYPE even over a PLANNED backend,
            # so only the top of the scale (Verified Live / Staging) is gated here.
            if _LEVEL_META[app.evidence_level]["rank"] > max(
                _LEVEL_META[ceiling]["rank"], _LEVEL_META[EvidenceLevel.PROTOTYPE]["rank"]
            ):
                problems.append(
                    f"{app.name}: evidence level {app.evidence_level.value} "
                    f"exceeds the {ceiling.value} ceiling its operational_truth "
                    f"features earn"
                )

        # Rule 4 — score bounds + production-readiness discipline.
        for dim in DIMENSIONS:
            val = app.scores.get(dim)
            if val is None:
                problems.append(f"{app.name}: missing score for '{dim}'")
            elif not 0 <= val <= 100:
                problems.append(f"{app.name}: score '{dim}'={val} out of range 0-100")
        if (
            app.evidence_level != EvidenceLevel.VERIFIED_LIVE
            and app.scores.get("production_readiness", 0) > 60
        ):
            problems.append(
                f"{app.name}: production_readiness="
                f"{app.scores.get('production_readiness')} too high for a "
                f"non-Verified-Live app (max 60)"
            )

    return problems


def evaluate(apps: list[AppAudit] | None = None) -> dict[str, Any]:
    apps = apps if apps is not None else _registry()
    consistency = check_consistency(apps)

    by_level: dict[str, int] = {lvl.value: 0 for lvl in EvidenceLevel}
    app_rows: list[dict[str, Any]] = []
    for app in apps:
        by_level[app.evidence_level.value] += 1
        app_rows.append(
            {
                "name": app.name,
                "surface": app.surface,
                "evidence_level": app.evidence_level.value,
                "badge": _LEVEL_META[app.evidence_level]["badge"],
                "evidence_label": _LEVEL_META[app.evidence_level]["label"],
                "scores": {d: app.scores.get(d, 0) for d in DIMENSIONS},
                "design_score": app.design_score(),
                "backing_live_features": app.backing_live_features,
                "truth_features": app.truth_features,
                "note": app.note,
            }
        )

    verified = [a for a in app_rows if a["evidence_level"] == "VERIFIED_LIVE"]
    return {
        "honest": not consistency,
        "consistency_violations": consistency,
        "app_count": len(apps),
        "by_evidence_level": by_level,
        "verified_live_count": len(verified),
        "apps": app_rows,
    }


def render(result: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("=" * 74)
    lines.append("  NOBLEPORT APP AUDIT — TRUTH SCORECARD")
    lines.append("=" * 74)
    lines.append("")
    lines.append(
        "  Evidence Level is the GATE (🟢 Verified Live · 🟡 Staging · "
        "🔵 Prototype · 🔴 Planned)."
    )
    lines.append(
        "  Dimension %s are build maturity only — they never promote the label."
        % "scores"
    )
    lines.append("")

    # Order apps most-proven first.
    order = {lvl.value: _LEVEL_META[lvl]["rank"] for lvl in EvidenceLevel}
    apps = sorted(
        result["apps"], key=lambda a: (-order[a["evidence_level"]], a["name"])
    )

    for a in apps:
        lines.append("-" * 74)
        lines.append(f"  {a['badge']}  {a['name']}   [{a['evidence_label']}]")
        lines.append(f"      surface: {a['surface']}")
        for dim in DIMENSIONS:
            bar_len = round(a["scores"][dim] / 5)  # 20-char full bar
            bar = "█" * bar_len + "·" * (20 - bar_len)
            lines.append(
                f"      {_DIMENSION_LABELS[dim]:<22} {bar} {a['scores'][dim]:>3}%"
            )
        lines.append(f"      {'Build-maturity avg':<22} {'':<20} {a['design_score']:>3}%")
        if a["backing_live_features"]:
            lines.append(
                "      backed by LIVE: " + ", ".join(a["backing_live_features"])
            )
        if a["note"]:
            lines.append(f"      note: {a['note']}")
        lines.append("")

    lines.append("=" * 74)
    counts = result["by_evidence_level"]
    lines.append(
        "  TOTALS:  "
        f"🟢 {counts['VERIFIED_LIVE']}   "
        f"🟡 {counts['STAGING']}   "
        f"🔵 {counts['PROTOTYPE']}   "
        f"🔴 {counts['PLANNED']}   "
        f"(of {result['app_count']} apps)"
    )
    if result["honest"]:
        lines.append("  HONESTY CHECK:  PASS — no app overstates its evidence level.")
    else:
        lines.append("  HONESTY CHECK:  FAIL — violations:")
        for v in result["consistency_violations"]:
            lines.append(f"    - {v}")
    lines.append("=" * 74)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="NoblePort per-app truth scorecard")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    parser.add_argument(
        "--app", help="show only the app whose name matches (case-insensitive)"
    )
    args = parser.parse_args(argv)

    apps = _registry()
    if args.app:
        needle = args.app.lower()
        apps = [a for a in apps if needle in a.name.lower()]
        if not apps:
            print(f"No app matches {args.app!r}", file=sys.stderr)
            return 2

    result = evaluate(apps)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(render(result))
    # Exit non-zero if any app overstates its evidence — so CI can gate on honesty.
    return 1 if not result["honest"] else 0


if __name__ == "__main__":
    sys.exit(main())
