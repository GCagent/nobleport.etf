"""
NoblePort TruthAuditor
======================

The TruthAuditor is the *node* the "Stephanie.ai Truth & Audit Module" was
supposed to be — but built honestly, on the machinery this repo already has,
rather than as a parallel surface that hand-asserts scores and mints fake
signatures.

It does exactly one thing: turn the two independent axes we already compute
into a single, defensible verdict for a named target.

  1. DESIGN MATURITY   -- architecture/design completeness (hand-scored,
                          conservative). Provided by ``truth_label`` and
                          ``operational_truth``. NEVER implies it runs.
  2. RUNTIME EVIDENCE   -- share of gating artifacts *proven* by collected
                          artifacts. Computed mechanically by
                          ``truth_label.evaluate`` from the evidence index.

From those two axes it derives exactly one canonical Truth-Layer tag
(``LIVE`` / ``STAGED`` / ``SIMULATED`` / ``BLOCKED``) using the same
``truth_layer`` protocol the decision gate enforces, and stamps the verdict
with a real SHA-256 integrity digest over the canonical report bytes (chained
to a prior digest, AuditBeacon-style).

What this module deliberately does NOT do:
  * It does not invent scores. Every number comes from ``truth_label.evaluate``
    or the ``operational_truth`` matrix.
  * It does not fabricate cryptographic signatures. The integrity digest is a
    real SHA-256 over the report; it is labelled as a digest, not an Ed25519
    signature. Ed25519 signing is a future step gated on a provisioned key
    (see ``sign_ed25519``), and is honestly reported as unavailable until then.

Run:
    python -m backend.verification.truth_auditor            # human-readable
    python -m backend.verification.truth_auditor --json     # machine output
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.governance.truth_layer import (
    TruthTag,
    assert_tagged,
    requires_human_approval,
)
from backend.verification import truth_label

GENESIS_DIGEST = "0" * 64

# The one honest oversight line every non-LIVE verdict carries. Mirrors the
# credential register's core rule: Stephanie.ai supports, a licensed human
# decides. Kept here so the API, the filter, and the CLI all say the same thing.
OVERSIGHT_NOTICE = (
    "Advisory only. Subject to licensed human oversight — not cleared for final "
    "engineering, legal, or investment decisions without a qualified reviewer."
)


@dataclass
class TruthAuditReport:
    """A single TruthAuditor verdict for a named target."""

    target: str
    generated_at: str

    # Runtime evidence axis (mechanically computed by truth_label).
    status: str
    classification: str
    evidence_level: str
    evidence_pct: int
    gating_total: int
    gating_collected: int
    gating_failed: list[str]

    # Design maturity axis (architecture only — NOT runtime evidence).
    design_maturity_avg: int

    # The single canonical Truth-Layer tag derived from both axes.
    truth_tag: str
    requires_human_approval: bool
    released: bool  # False when BLOCKED — the verdict is withheld from action
    disclaimer: str

    artifacts: list[dict[str, Any]] = field(default_factory=list)

    # Integrity — a REAL sha256 over the canonical report, chained to the prior
    # verdict's digest. This is not a signature and is not labelled as one.
    prev_digest: str = GENESIS_DIGEST
    integrity_sha256: str = ""
    ed25519_signature: str | None = None  # populated only if a key is provisioned

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _derive_tag(evaluation: dict[str, Any]) -> TruthTag:
    """
    Map the mechanically-computed evidence state onto exactly one Truth-Layer
    tag. Fail-closed: any actively FAILED gating artifact is BLOCKED, and design
    maturity NEVER upgrades a verdict — only collected runtime evidence does.

      BLOCKED  a gating artifact has actively FAILED verification.
      LIVE     every gating artifact is COLLECTED + passing (RC1).
      STAGED   partial or zero runtime evidence — draft-state, human sign-off
               required before any real-world effect. (Design-only lands here,
               never LIVE.)
    """
    if evaluation["gating_failed"]:
        return TruthTag.BLOCKED
    if evaluation["evidence_pct"] >= 100:
        return TruthTag.LIVE
    return TruthTag.STAGED


def _integrity_digest(report: TruthAuditReport) -> str:
    """
    Deterministic SHA-256 over the canonical report body, chained to the prior
    verdict's digest — the same tamper-evident construction StephanieGate and
    AuditBeacon use. Excludes the digest/signature fields themselves.
    """
    body = report.to_dict()
    body.pop("integrity_sha256", None)
    body.pop("ed25519_signature", None)
    payload = json.dumps(body, sort_keys=True)
    return hashlib.sha256(f"{report.prev_digest}{payload}".encode()).hexdigest()


def audit(
    target: str,
    *,
    evidence_dir: Path = truth_label.EVIDENCE_DIR,
    prev_digest: str = GENESIS_DIGEST,
    simulated: bool = False,
    now: datetime | None = None,
) -> TruthAuditReport:
    """
    Produce a TruthAudit verdict for ``target`` from the real evidence index.

    ``simulated=True`` marks a scenario/demo run: an otherwise-LIVE verdict is
    demoted to SIMULATED so a demo can never masquerade as production truth.
    """
    evaluation = truth_label.evaluate(evidence_dir)
    tag = _derive_tag(evaluation)

    if simulated and tag == TruthTag.LIVE:
        tag = TruthTag.SIMULATED

    # Enforce the protocol rule: no verdict ships without a confirmed tag.
    tag = assert_tagged(tag)

    stamp = (now or datetime.now(timezone.utc)).isoformat()
    report = TruthAuditReport(
        target=target,
        generated_at=stamp,
        status=evaluation["status"],
        classification=evaluation["classification"],
        evidence_level=evaluation["evidence_level"],
        evidence_pct=evaluation["evidence_pct"],
        gating_total=evaluation["gating_total"],
        gating_collected=evaluation["gating_collected"],
        gating_failed=list(evaluation["gating_failed"]),
        design_maturity_avg=evaluation["design_maturity_avg"],
        truth_tag=tag.value,
        requires_human_approval=requires_human_approval(tag),
        released=tag != TruthTag.BLOCKED,
        disclaimer="" if tag == TruthTag.LIVE else OVERSIGHT_NOTICE,
        artifacts=evaluation["artifacts"],
        prev_digest=prev_digest,
    )
    report.integrity_sha256 = _integrity_digest(report)
    return report


def sign_ed25519(report: TruthAuditReport, private_key_pem: str | None = None) -> TruthAuditReport:
    """
    Attach an Ed25519 signature over the integrity digest — IF a key is
    provisioned. With no key, this is a no-op and ``ed25519_signature`` stays
    ``None`` (honestly unsigned), rather than fabricating a signature.
    """
    if not private_key_pem:
        return report  # honest: no key, no signature
    try:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import (
            Ed25519PrivateKey,
        )
        from cryptography.hazmat.primitives.serialization import load_pem_private_key
    except ImportError:
        return report

    key = load_pem_private_key(private_key_pem.encode(), password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise ValueError("Provided key is not an Ed25519 private key")
    signature = key.sign(report.integrity_sha256.encode())
    report.ed25519_signature = signature.hex()
    return report


def verify_digest(report: TruthAuditReport) -> bool:
    """Recompute the integrity digest and confirm it matches (tamper check)."""
    return _integrity_digest(report) == report.integrity_sha256


def render(report: TruthAuditReport) -> str:
    lines: list[str] = []
    lines.append("=" * 66)
    lines.append(f"  TRUTH AUDITOR — {report.target}")
    lines.append("=" * 66)
    lines.append("")
    lines.append(f"  TRUTH-LAYER TAG:      {report.truth_tag}")
    lines.append(f"  STATUS:               {report.status}")
    lines.append(f"  CLASSIFICATION:       {report.classification}")
    lines.append(f"  EVIDENCE LEVEL:       {report.evidence_level}  ({report.evidence_pct}%)")
    lines.append(
        f"  GATING PROVEN:        {report.gating_collected}/{report.gating_total}"
    )
    lines.append(f"  DESIGN MATURITY:      {report.design_maturity_avg}%  (architecture axis only)")
    lines.append(f"  HUMAN APPROVAL REQ:   {'YES' if report.requires_human_approval else 'NO'}")
    lines.append(f"  RELEASED:             {'YES' if report.released else 'NO — WITHHELD/ESCALATE'}")
    if report.gating_failed:
        lines.append(f"  BLOCKING FAILURES:    {', '.join(report.gating_failed)}")
    if report.disclaimer:
        lines.append("")
        lines.append(f"  {report.disclaimer}")
    lines.append("")
    lines.append("-" * 66)
    lines.append(f"  INTEGRITY SHA-256:    {report.integrity_sha256}")
    lines.append(f"  PREV DIGEST:          {report.prev_digest}")
    sig = report.ed25519_signature or "(unsigned — no Ed25519 key provisioned)"
    lines.append(f"  ED25519 SIGNATURE:    {sig}")
    lines.append("-" * 66)
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="NoblePort TruthAuditor")
    parser.add_argument("--target", default="NoblePort Platform", help="audit target name")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    parser.add_argument("--simulated", action="store_true", help="mark as scenario/demo run")
    parser.add_argument(
        "--evidence",
        type=Path,
        default=truth_label.EVIDENCE_DIR,
        help="evidence directory (default: backend/verification/evidence)",
    )
    args = parser.parse_args(argv)

    report = audit(args.target, evidence_dir=args.evidence, simulated=args.simulated)
    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        print(render(report))
    # Non-zero exit when the verdict is BLOCKED, so CI can gate on it.
    return 1 if report.truth_tag == TruthTag.BLOCKED.value else 0


if __name__ == "__main__":
    sys.exit(main())
