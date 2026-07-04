"""
NoblePort Truth Label Generator
===============================

Produces the evidence-gated truth label for a release candidate, using the same
honesty standard already enforced by ``backend/config/operational_truth.py`` for
feature surfaces — extended here to the *whole platform* for an RC decision.

The label is a function of two independent axes:

  1. DESIGN MATURITY   -- how complete the architecture/code/design is.
                          Hand-scored, conservative. Does NOT imply it runs.
  2. EVIDENCE LEVEL    -- how much of the runtime behaviour has been *proven*
                          by collected artifacts. Computed mechanically from the
                          evidence index, never asserted by hand.

A system is only ever labelled RC1 (Production Candidate) when EVERY gating
artifact is COLLECTED and PASSING. Anything less is STAGED / PRE-PRODUCTION.

Run:
    python -m backend.verification.truth_label                # human-readable
    python -m backend.verification.truth_label --json         # machine output
    python -m backend.verification.truth_label --evidence DIR # custom evidence dir
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

EVIDENCE_DIR = Path(__file__).parent / "evidence"
EVIDENCE_INDEX = "evidence_index.json"


class ArtifactStatus(str, Enum):
    COLLECTED = "COLLECTED"   # artifact exists and the check passed
    FAILED = "FAILED"         # artifact exists and the check failed
    PENDING = "PENDING"       # not yet collected (requires live deployment, etc.)
    NA = "NOT_APPLICABLE"     # feature not implemented in this build (honest skip)


@dataclass
class Artifact:
    key: str
    title: str
    # True if this artifact must be COLLECTED+passing before RC1 can be claimed.
    gating: bool
    # Can this be produced in CI/local without a live deployment + real vendors?
    runnable_offline: bool
    how: str
    status: ArtifactStatus = ArtifactStatus.PENDING
    detail: str = ""


# The 10 RC1 evidence artifacts the audit requires, mapped to the *actual*
# NoblePort stack (FastAPI + SQLAlchemy/Alembic + Stripe + Next.js), not the
# generic TypeScript/Prisma stack the audit template assumed.
def _artifacts() -> list[Artifact]:
    return [
        Artifact(
            "build_typecheck",
            "Backend import + frontend typecheck logs",
            gating=True,
            runnable_offline=True,
            how="python -c 'import backend.main' ; npm run typecheck",
        ),
        Artifact(
            "migration_roundtrip",
            "Alembic migration upgrade -> downgrade -> upgrade output",
            gating=True,
            runnable_offline=True,
            how="pytest backend/verification/tests/test_migration_rollback.py",
        ),
        Artifact(
            "route_contract",
            "API route contract (every advertised route is registered)",
            gating=True,
            runnable_offline=True,
            how="pytest backend/verification/tests/test_route_contract.py",
        ),
        Artifact(
            "health_endpoint",
            "Health endpoint output (exact status match, no substring drift)",
            gating=True,
            runnable_offline=True,
            how="backend/verification/verify_deployment.sh",
        ),
        Artifact(
            "payment_verification",
            "Payment endpoint exercised against real route + deposit gate",
            gating=True,
            runnable_offline=True,
            how="pytest backend/verification/tests/test_payment_verification.py",
        ),
        Artifact(
            "webhook_security",
            "Stripe webhook signature validation (reject/accept matrix)",
            gating=True,
            runnable_offline=True,
            how="pytest backend/verification/tests/test_webhook_security.py",
        ),
        Artifact(
            "load_report",
            "k6 tiered load report (250 / 500 / 1000 concurrent users)",
            gating=True,
            runnable_offline=False,
            how="k6 run backend/verification/load/k6_tiered.js (vs deployed env)",
        ),
        Artifact(
            "stripe_sandbox",
            "Stripe sandbox payment evidence (live test-mode intent + webhook)",
            gating=True,
            runnable_offline=False,
            how="Run against Stripe test mode with real test keys; capture event log",
        ),
        Artifact(
            "object_storage",
            "Object storage upload/retrieve/sign/delete proof",
            gating=False,
            runnable_offline=True,
            how="pytest backend/verification/tests/test_object_storage.py",
        ),
        Artifact(
            "worker_logs",
            "Background worker / scheduled sync execution logs",
            gating=False,
            runnable_offline=False,
            how="Capture APScheduler/Celery logs from deployed environment",
        ),
    ]


# Hand-scored design maturity, mirroring the audit's classification table. These
# describe the DESIGN axis only and are explicitly NOT evidence of runtime.
DESIGN_MATURITY: dict[str, int] = {
    "Architecture": 93,
    "Database": 94,
    "API Design": 90,
    "Security Design": 82,
    "Compliance Design": 85,
    "Deployment Design": 90,
}


def load_evidence(evidence_dir: Path) -> dict[str, dict[str, str]]:
    """Read the evidence index written by run_verification.sh, if present."""
    index_path = evidence_dir / EVIDENCE_INDEX
    if not index_path.exists():
        return {}
    try:
        data = json.loads(index_path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}
    return data.get("artifacts", {})


def evaluate(evidence_dir: Path = EVIDENCE_DIR) -> dict[str, Any]:
    collected = load_evidence(evidence_dir)
    artifacts = _artifacts()

    for art in artifacts:
        rec = collected.get(art.key)
        if rec:
            try:
                art.status = ArtifactStatus(rec.get("status", "PENDING"))
            except ValueError:
                art.status = ArtifactStatus.PENDING
            art.detail = rec.get("detail", "")

    gating = [a for a in artifacts if a.gating]
    gating_collected = [a for a in gating if a.status == ArtifactStatus.COLLECTED]
    gating_failed = [a for a in gating if a.status == ArtifactStatus.FAILED]

    # Evidence level is the share of GATING artifacts proven.
    if not gating:
        evidence_pct = 0
    else:
        evidence_pct = round(100 * len(gating_collected) / len(gating))

    if gating_failed:
        status = "BLOCKED"
        classification = "FAILED-VERIFICATION"
    elif evidence_pct == 0:
        status = "STAGED"
        classification = "PRE-PRODUCTION"
    elif evidence_pct < 100:
        status = "STAGED"
        classification = "PARTIAL-EVIDENCE"
    else:
        status = "RC1"
        classification = "PRODUCTION-CANDIDATE"

    if evidence_pct == 0:
        evidence_level = "NONE"
    elif evidence_pct < 50:
        evidence_level = "LOW"
    elif evidence_pct < 100:
        evidence_level = "PARTIAL"
    else:
        evidence_level = "FULL"

    return {
        "status": status,
        "classification": classification,
        "evidence_level": evidence_level,
        "evidence_pct": evidence_pct,
        "deployment_verified": status == "RC1",
        "production_certified": status == "RC1",
        "design_maturity": DESIGN_MATURITY,
        "design_maturity_avg": round(sum(DESIGN_MATURITY.values()) / len(DESIGN_MATURITY)),
        "gating_total": len(gating),
        "gating_collected": len(gating_collected),
        "gating_failed": [a.key for a in gating_failed],
        "artifacts": [
            {
                "key": a.key,
                "title": a.title,
                "gating": a.gating,
                "runnable_offline": a.runnable_offline,
                "status": a.status.value,
                "detail": a.detail,
                "how": a.how,
            }
            for a in artifacts
        ],
    }


def render(result: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("=" * 66)
    lines.append("  NOBLEPORT VERIFICATION — TRUTH LABEL")
    lines.append("=" * 66)
    lines.append("")
    lines.append("  DESIGN MATURITY (architecture axis — NOT runtime evidence)")
    for area, score in result["design_maturity"].items():
        lines.append(f"    {area:<20} {score:>3}%")
    lines.append(f"    {'AVERAGE':<20} {result['design_maturity_avg']:>3}%")
    lines.append("")
    lines.append("  RUNTIME EVIDENCE (execution axis — mechanically computed)")
    for art in result["artifacts"]:
        mark = {
            "COLLECTED": "[x]",
            "FAILED": "[!]",
            "PENDING": "[ ]",
            "NOT_APPLICABLE": "[-]",
        }.get(art["status"], "[ ]")
        gate = "GATING" if art["gating"] else "      "
        lines.append(f"    {mark} {gate}  {art['title']}")
        if art["detail"]:
            lines.append(f"              -> {art['detail']}")
    lines.append("")
    lines.append(
        f"  Gating artifacts proven: {result['gating_collected']}/{result['gating_total']}"
        f"  ({result['evidence_pct']}%)"
    )
    lines.append("")
    lines.append("-" * 66)
    lines.append(f"  STATUS:               {result['status']}")
    lines.append(f"  CLASSIFICATION:       {result['classification']}")
    lines.append(f"  EVIDENCE LEVEL:       {result['evidence_level']}")
    lines.append(f"  DEPLOYMENT VERIFIED:  {'YES' if result['deployment_verified'] else 'NO'}")
    lines.append(f"  PRODUCTION CERTIFIED: {'YES' if result['production_certified'] else 'NO'}")
    lines.append("-" * 66)
    if result["gating_failed"]:
        lines.append("  BLOCKING FAILURES: " + ", ".join(result["gating_failed"]))
        lines.append("-" * 66)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="NoblePort truth label generator")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    parser.add_argument(
        "--evidence",
        type=Path,
        default=EVIDENCE_DIR,
        help="evidence directory (default: backend/verification/evidence)",
    )
    args = parser.parse_args(argv)

    result = evaluate(args.evidence)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(render(result))
    # Non-zero exit if any gating artifact has actively FAILED, so CI can gate.
    return 1 if result["gating_failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
