"""
NoblePort OS — TruthAuditor Agent

The mesh node for the Truth & Audit Module. It is a thin orchestration layer
over two things that already exist and are already tested:

  * ``backend.verification.truth_auditor`` — turns the evidence index + design
    maturity into a single Truth-Layer verdict with a real integrity digest.
  * ``backend.governance.pre_output_filter`` — routes avatar/briefing text
    through the Truth-Layer + Credential Register enforcement point.

The agent adds nothing to the truth computation itself — deliberately. All the
numbers come from collected artifacts, so there is no surface here on which a
score could be asserted by hand. Tasks:

  audit_target       -> TruthAuditReport for a named target (from real evidence)
  pre_output_filter  -> route an output through the truth filter before release
  verify_digest      -> recompute a report's integrity digest (tamper check)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from backend.agents.base import AgentFamily, BaseAgent
from backend.governance.pre_output_filter import filter_output
from backend.verification import truth_auditor as core

logger = logging.getLogger(__name__)


class TruthAuditorAgent(BaseAgent):
    """
    TruthAuditor — the governance node that scores nothing by hand.

    Every verdict it emits is a mechanical function of the evidence index and
    the design-maturity table; every output it clears carries a confirmed
    Truth-Layer tag. It is the enforcement point avatar and briefing responses
    are routed through before they reach a human.
    """

    def __init__(self, agent_id: str | None = None) -> None:
        super().__init__(
            name="TruthAuditor",
            family=AgentFamily.TRUTH_AUDITOR,
            role=(
                "Evidence-gated truth verdicts and pre-output enforcement — "
                "derives one Truth-Layer tag per target from collected artifacts, "
                "never hand-asserts a score"
            ),
            agent_id=agent_id or "truth-auditor-primary",
        )

    async def _handle_task(
        self,
        task_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        match task_type:
            case "audit_target":
                return await self.audit_target(
                    target=payload.get("target", "NoblePort Platform"),
                    evidence_dir=payload.get("evidence_dir"),
                    prev_digest=payload.get("prev_digest", core.GENESIS_DIGEST),
                    simulated=bool(payload.get("simulated", False)),
                )
            case "pre_output_filter":
                return await self.pre_output_filter(
                    text=payload.get("text", ""),
                    tag=payload.get("tag"),
                    target=payload.get("target"),
                    auto_tag=bool(payload.get("auto_tag", False)),
                )
            case "verify_digest":
                return await self.verify_digest(payload.get("report", {}))
            case _:
                raise ValueError(f"TruthAuditor cannot handle task type {task_type!r}")

    async def audit_target(
        self,
        target: str,
        *,
        evidence_dir: str | None = None,
        prev_digest: str = core.GENESIS_DIGEST,
        simulated: bool = False,
    ) -> dict[str, Any]:
        """Produce a TruthAudit verdict for ``target`` from the real evidence index."""
        kwargs: dict[str, Any] = {"prev_digest": prev_digest, "simulated": simulated}
        if evidence_dir:
            kwargs["evidence_dir"] = Path(evidence_dir)
        report = core.audit(target, **kwargs)
        logger.info(
            "TruthAuditor verdict for %s: tag=%s evidence=%s%% (%d/%d gating)",
            target, report.truth_tag, report.evidence_pct,
            report.gating_collected, report.gating_total,
        )
        return report.to_dict()

    async def pre_output_filter(
        self,
        text: str,
        tag: str | None = None,
        *,
        target: str | None = None,
        auto_tag: bool = False,
    ) -> dict[str, Any]:
        """
        Route an output through the pre-output truth filter.

        If ``auto_tag`` is set and no explicit ``tag`` is given, the tag is
        derived from a fresh audit of ``target`` — so the avatar's read is
        gated by the same evidence everything else is.
        """
        effective_tag = tag
        if auto_tag and not tag:
            report = core.audit(target or "NoblePort Platform")
            effective_tag = report.truth_tag
        result = filter_output(text, effective_tag, target=target)
        logger.info(
            "TruthAuditor filtered output: tag=%s disposition=%s released=%s",
            result.tag, result.disposition, result.released,
        )
        return result.to_dict()

    async def verify_digest(self, report_dict: dict[str, Any]) -> dict[str, Any]:
        """Recompute a report's integrity digest to confirm it hasn't been altered."""
        report = core.TruthAuditReport(**report_dict)
        intact = core.verify_digest(report)
        return {"target": report.target, "integrity_intact": intact}
