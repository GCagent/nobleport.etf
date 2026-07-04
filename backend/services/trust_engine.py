"""
Cyborg.io Trust Engine

Cyborg.io answers one question: "Can this entity or action be trusted?"
This service is the Phase 1 Trust Foundation plus the Phase 2 construction
credentials that NoblePort needs first: contractor licensing (MA CSL / HIC)
and insurance (COI) verification, a policy engine over the results, and a
trust score — every answer delivered as an EVIDENCE OBJECT, never a bare
pass/fail.

Honesty rules (Truth-Layer aligned):

  * VERIFIED is reserved for checks confirmed against an authoritative
    source (state registry, carrier API). No registry adapter is connected
    yet, so today's document review can achieve at most REPORTED — the
    submitted documents are internally consistent, current, and well-formed,
    but self-reported.
  * Because of that, the policy engine can currently return CONDITIONAL
    (human review required, TruthTag STAGED) at best. APPROVED (TruthTag
    LIVE) becomes reachable only when registry lookups are wired in.
  * Every evidence object is appended to a Proof-of-Trust hash chain at
    issuance, so audit evidence is tamper-evident by construction.

Ecosystem position (target architecture): Stephanie.ai orchestrates;
Cyborg.io verifies/authenticates/scores trust/produces evidence; analytics
and research live elsewhere (KUZO), dashboards elsewhere (NobleDash).
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from typing import Any

from backend.core.proof_of_trust import ProofOfTrust
from backend.governance.truth_layer import TruthTag

# ---------------------------------------------------------------------------
# Evidence model
# ---------------------------------------------------------------------------


class EvidenceVerdict(str, Enum):
    VERIFIED = "verified"      # Confirmed against an authoritative source
    REPORTED = "reported"      # Self-reported documents pass all checks
    UNVERIFIED = "unverified"  # Insufficient data to evaluate
    FAILED = "failed"          # At least one check failed


class VerificationMethod(str, Enum):
    DOCUMENT_REVIEW = "document_review"  # Available today
    REGISTRY_LOOKUP = "registry_lookup"  # Planned: MA DPL/OPSI, carrier APIs


class CredentialType(str, Enum):
    MA_CSL = "ma_csl"              # MA Construction Supervisor License
    MA_HIC = "ma_hic"              # MA Home Improvement Contractor reg.
    INSURANCE_GL = "insurance_gl"  # General liability COI


@dataclass(frozen=True)
class EvidenceCheck:
    """One atomic check inside an evidence object."""

    name: str
    passed: bool
    detail: str


@dataclass
class EvidenceObject:
    """
    The unit of trust: what was claimed, what was checked, what the checks
    found, how it was checked, and the hash-chain anchor proving when.
    """

    evidence_id: str
    subject_id: str
    subject_name: str
    claim: str
    credential_type: CredentialType
    verdict: EvidenceVerdict
    method: VerificationMethod
    truth_tag: TruthTag
    checks: list[EvidenceCheck]
    sources: list[str]
    evaluated_at: datetime
    expires_at: datetime | None
    chain_record_id: str | None = None
    chain_record_hash: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "evidence_id": self.evidence_id,
            "subject_id": self.subject_id,
            "subject_name": self.subject_name,
            "claim": self.claim,
            "credential_type": self.credential_type.value,
            "verdict": self.verdict.value,
            "method": self.method.value,
            "truth_tag": self.truth_tag.value,
            "checks": [
                {"name": c.name, "passed": c.passed, "detail": c.detail}
                for c in self.checks
            ],
            "sources": self.sources,
            "evaluated_at": self.evaluated_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "chain_record_id": self.chain_record_id,
            "chain_record_hash": self.chain_record_hash,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# Policy model
# ---------------------------------------------------------------------------


class PolicyDecision(str, Enum):
    APPROVED = "approved"        # Every requirement VERIFIED (LIVE)
    CONDITIONAL = "conditional"  # Passed on self-reported evidence (STAGED)
    REJECTED = "rejected"        # A requirement failed or is missing (BLOCKED)


@dataclass(frozen=True)
class PolicyRequirement:
    """A credential the policy demands, with an optional coverage floor."""

    credential_type: CredentialType
    min_coverage: float | None = None  # For insurance requirements
    description: str = ""


@dataclass(frozen=True)
class TrustPolicy:
    name: str
    description: str
    requirements: tuple[PolicyRequirement, ...]


POLICIES: dict[str, TrustPolicy] = {
    "subcontractor_onboarding": TrustPolicy(
        name="subcontractor_onboarding",
        description=(
            "A subcontractor may be onboarded to a NoblePort job only with a "
            "current MA license (CSL or HIC) and general liability coverage "
            "of at least $1M per occurrence."
        ),
        requirements=(
            PolicyRequirement(
                CredentialType.MA_CSL,
                description="Current MA Construction Supervisor License",
            ),
            PolicyRequirement(
                CredentialType.INSURANCE_GL,
                min_coverage=1_000_000.0,
                description="GL coverage >= $1M per occurrence",
            ),
        ),
    ),
    "payment_release": TrustPolicy(
        name="payment_release",
        description=(
            "A subcontractor payment may be released only while license and "
            "insurance evidence are both current and unexpired."
        ),
        requirements=(
            PolicyRequirement(
                CredentialType.MA_CSL,
                description="License evidence current at time of payment",
            ),
            PolicyRequirement(
                CredentialType.INSURANCE_GL,
                min_coverage=1_000_000.0,
                description="Insurance evidence current at time of payment",
            ),
        ),
    ),
}


@dataclass
class PolicyEvaluation:
    policy: str
    subject_id: str
    decision: PolicyDecision
    truth_tag: TruthTag
    reasons: list[str]
    evidence_ids: list[str]
    evaluated_at: datetime
    chain_record_id: str | None = None
    chain_record_hash: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "policy": self.policy,
            "subject_id": self.subject_id,
            "decision": self.decision.value,
            "truth_tag": self.truth_tag.value,
            "reasons": self.reasons,
            "evidence_ids": self.evidence_ids,
            "evaluated_at": self.evaluated_at.isoformat(),
            "chain_record_id": self.chain_record_id,
            "chain_record_hash": self.chain_record_hash,
        }


# ---------------------------------------------------------------------------
# Trust Engine
# ---------------------------------------------------------------------------

# MA CSL numbers look like "CS-107345"; HIC registrations are numeric.
_CSL_PATTERN = re.compile(r"^CS[-\s]?\d{5,6}$", re.IGNORECASE)
_HIC_PATTERN = re.compile(r"^\d{5,6}$")

# Evidence freshness: how long an evidence object stays citable before the
# credential must be re-verified.
EVIDENCE_TTL_DAYS = 90

# Trust score weights per verdict.
_VERDICT_WEIGHT: dict[EvidenceVerdict, float] = {
    EvidenceVerdict.VERIFIED: 1.0,
    EvidenceVerdict.REPORTED: 0.7,
    EvidenceVerdict.UNVERIFIED: 0.2,
    EvidenceVerdict.FAILED: 0.0,
}


class TrustEngine:
    """
    Cyborg.io's verification core. Stateless checks, stateful evidence:
    every issued evidence object and policy evaluation is retained and
    anchored to an append-only Proof-of-Trust hash chain.
    """

    def __init__(self) -> None:
        self._evidence: dict[str, EvidenceObject] = {}
        self._by_subject: dict[str, list[str]] = {}
        self._chain = ProofOfTrust()

    # ------------------------------------------------------------------
    # Credential verification
    # ------------------------------------------------------------------

    def verify_license(
        self,
        subject_id: str,
        subject_name: str,
        license_number: str,
        license_type: str = "ma_csl",
        holder_name: str | None = None,
        expiration_date: date | None = None,
    ) -> EvidenceObject:
        """
        Verify a MA contractor license from submitted documents.
        Registry lookup (mass.gov DPL/OPSI) is not connected yet, so the
        best achievable verdict is REPORTED.
        """
        cred = CredentialType(license_type)
        checks: list[EvidenceCheck] = []

        pattern = _CSL_PATTERN if cred == CredentialType.MA_CSL else _HIC_PATTERN
        number = (license_number or "").strip()
        checks.append(
            EvidenceCheck(
                name="license_number_format",
                passed=bool(pattern.match(number)),
                detail=(
                    f"{cred.value} number {number!r} "
                    + ("matches" if pattern.match(number) else "does not match")
                    + " the expected format."
                ),
            )
        )

        if expiration_date is None:
            checks.append(
                EvidenceCheck(
                    name="expiration_provided",
                    passed=False,
                    detail="No expiration date submitted.",
                )
            )
        else:
            current = expiration_date >= date.today()
            checks.append(
                EvidenceCheck(
                    name="license_current",
                    passed=current,
                    detail=(
                        f"License expires {expiration_date.isoformat()} — "
                        + ("current." if current else "EXPIRED.")
                    ),
                )
            )

        name_match = None
        if holder_name:
            name_match = holder_name.strip().lower() == subject_name.strip().lower()
            checks.append(
                EvidenceCheck(
                    name="holder_name_match",
                    passed=name_match,
                    detail=(
                        f"License holder {holder_name!r} "
                        + ("matches" if name_match else "does not match")
                        + f" subject {subject_name!r}."
                    ),
                )
            )

        return self._issue(
            subject_id=subject_id,
            subject_name=subject_name,
            claim=f"Holds current {cred.value.upper()} license {number}",
            credential_type=cred,
            checks=checks,
            sources=["submitted_documents"],
            metadata={"license_number": number, "license_type": cred.value},
        )

    def verify_insurance(
        self,
        subject_id: str,
        subject_name: str,
        carrier: str,
        policy_number: str,
        each_occurrence: float,
        effective_date: date | None = None,
        expiration_date: date | None = None,
        min_coverage: float = 1_000_000.0,
    ) -> EvidenceObject:
        """
        Verify a general-liability certificate of insurance (COI) from
        submitted documents. Carrier confirmation is not connected yet, so
        the best achievable verdict is REPORTED.
        """
        checks: list[EvidenceCheck] = []
        today = date.today()

        checks.append(
            EvidenceCheck(
                name="policy_identified",
                passed=bool(carrier.strip()) and bool(policy_number.strip()),
                detail=f"Carrier {carrier!r}, policy {policy_number!r}.",
            )
        )
        meets = each_occurrence >= min_coverage
        checks.append(
            EvidenceCheck(
                name="coverage_minimum",
                passed=meets,
                detail=(
                    f"Each-occurrence ${each_occurrence:,.0f} "
                    + ("meets" if meets else "is BELOW")
                    + f" the ${min_coverage:,.0f} minimum."
                ),
            )
        )
        if expiration_date is None:
            checks.append(
                EvidenceCheck(
                    name="expiration_provided",
                    passed=False,
                    detail="No expiration date on the COI.",
                )
            )
        else:
            in_force = expiration_date >= today and (
                effective_date is None or effective_date <= today
            )
            checks.append(
                EvidenceCheck(
                    name="policy_in_force",
                    passed=in_force,
                    detail=(
                        f"Policy window {effective_date or 'unknown'} → "
                        f"{expiration_date} — "
                        + ("in force." if in_force else "NOT in force.")
                    ),
                )
            )

        return self._issue(
            subject_id=subject_id,
            subject_name=subject_name,
            claim=(
                f"Carries GL coverage of ${each_occurrence:,.0f} per "
                f"occurrence with {carrier}"
            ),
            credential_type=CredentialType.INSURANCE_GL,
            checks=checks,
            sources=["submitted_coi"],
            metadata={
                "carrier": carrier,
                "policy_number": policy_number,
                "each_occurrence": each_occurrence,
            },
        )

    # ------------------------------------------------------------------
    # Policy engine
    # ------------------------------------------------------------------

    def evaluate_policy(
        self, policy_name: str, subject_id: str
    ) -> PolicyEvaluation:
        """
        Evaluate a subject's current (unexpired) evidence against a policy.

        APPROVED    every requirement VERIFIED               -> LIVE
        CONDITIONAL every requirement passed, >=1 REPORTED   -> STAGED
        REJECTED    a requirement FAILED or has no evidence  -> BLOCKED
        """
        policy = POLICIES.get(policy_name)
        if policy is None:
            raise ValueError(
                f"Unknown policy {policy_name!r}; "
                f"valid: {sorted(POLICIES)}"
            )

        now = datetime.now(timezone.utc)
        reasons: list[str] = []
        used: list[str] = []
        failed = False
        all_verified = True

        for req in policy.requirements:
            ev = self._latest_evidence(subject_id, req.credential_type)
            if ev is None:
                failed = True
                reasons.append(
                    f"No evidence on file for {req.credential_type.value}."
                )
                continue
            used.append(ev.evidence_id)

            if ev.expires_at and ev.expires_at < now:
                failed = True
                reasons.append(
                    f"Evidence {ev.evidence_id} for "
                    f"{req.credential_type.value} is stale "
                    f"(expired {ev.expires_at.date()}); re-verify."
                )
                continue
            if ev.verdict == EvidenceVerdict.FAILED:
                failed = True
                bad = [c.detail for c in ev.checks if not c.passed]
                reasons.append(
                    f"{req.credential_type.value} failed verification: "
                    + " ".join(bad)
                )
                continue
            if ev.verdict == EvidenceVerdict.UNVERIFIED:
                failed = True
                reasons.append(
                    f"{req.credential_type.value} could not be evaluated "
                    "(insufficient data)."
                )
                continue
            if (
                req.min_coverage is not None
                and ev.metadata.get("each_occurrence", 0) < req.min_coverage
            ):
                failed = True
                reasons.append(
                    f"Coverage below policy floor of ${req.min_coverage:,.0f}."
                )
                continue
            if ev.verdict != EvidenceVerdict.VERIFIED:
                all_verified = False
                reasons.append(
                    f"{req.credential_type.value} passed on self-reported "
                    "documents only (REPORTED) — human review required."
                )

        if failed:
            decision, tag = PolicyDecision.REJECTED, TruthTag.BLOCKED
        elif all_verified:
            decision, tag = PolicyDecision.APPROVED, TruthTag.LIVE
            reasons.append("All requirements verified against authoritative sources.")
        else:
            decision, tag = PolicyDecision.CONDITIONAL, TruthTag.STAGED

        evaluation = PolicyEvaluation(
            policy=policy.name,
            subject_id=subject_id,
            decision=decision,
            truth_tag=tag,
            reasons=reasons,
            evidence_ids=used,
            evaluated_at=now,
        )

        rec = self._chain.record(
            actor="cyborg.io",
            actor_type="agent",
            agent_family="Cyborg",
            action=f"policy_evaluated:{policy.name}:{decision.value}",
            subject=subject_id,
            approval_type="auto",
            evidence_ids=used,
            decision=decision.value,
        )
        evaluation.chain_record_id = rec.id
        evaluation.chain_record_hash = rec.record_hash
        return evaluation

    # ------------------------------------------------------------------
    # Trust score
    # ------------------------------------------------------------------

    def trust_score(self, subject_id: str) -> dict[str, Any]:
        """
        Score 0–100 from the subject's latest evidence per credential type.
        The breakdown always accompanies the number — a score without its
        evidence is not citable.
        """
        now = datetime.now(timezone.utc)
        breakdown: list[dict[str, Any]] = []
        weights: list[float] = []

        for cred in CredentialType:
            ev = self._latest_evidence(subject_id, cred)
            if ev is None:
                continue
            weight = _VERDICT_WEIGHT[ev.verdict]
            stale = bool(ev.expires_at and ev.expires_at < now)
            if stale:
                weight *= 0.5
            weights.append(weight)
            breakdown.append(
                {
                    "credential_type": cred.value,
                    "evidence_id": ev.evidence_id,
                    "verdict": ev.verdict.value,
                    "stale": stale,
                    "contribution": round(weight * 100),
                }
            )

        score = round(sum(weights) / len(weights) * 100) if weights else 0
        return {
            "subject_id": subject_id,
            "score": score,
            "scale": "0-100",
            "basis": (
                "Latest evidence per credential type; verified=100, "
                "reported=70, unverified=20, failed=0; stale evidence "
                "halved. No evidence -> 0."
            ),
            "breakdown": breakdown,
            "evaluated_at": now.isoformat(),
        }

    # ------------------------------------------------------------------
    # Evidence access & chain proofs
    # ------------------------------------------------------------------

    def get_evidence(self, evidence_id: str) -> EvidenceObject:
        ev = self._evidence.get(evidence_id)
        if ev is None:
            raise ValueError(f"Evidence {evidence_id} not found")
        return ev

    def evidence_for_subject(self, subject_id: str) -> list[EvidenceObject]:
        return [
            self._evidence[eid]
            for eid in self._by_subject.get(subject_id, [])
        ]

    def verify_chain(self) -> bool:
        """Tamper-evidence: re-verify the whole evidence hash chain."""
        return self._chain.verify_full_chain()

    def chain_proof(self, evidence_id: str) -> dict[str, Any]:
        ev = self.get_evidence(evidence_id)
        if not ev.chain_record_id:
            raise ValueError(f"Evidence {evidence_id} has no chain anchor")
        return self._chain.get_proof(ev.chain_record_id)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _latest_evidence(
        self, subject_id: str, credential_type: CredentialType
    ) -> EvidenceObject | None:
        matches = [
            ev
            for ev in self.evidence_for_subject(subject_id)
            if ev.credential_type == credential_type
        ]
        return max(matches, key=lambda e: e.evaluated_at) if matches else None

    def _issue(
        self,
        subject_id: str,
        subject_name: str,
        claim: str,
        credential_type: CredentialType,
        checks: list[EvidenceCheck],
        sources: list[str],
        metadata: dict[str, Any],
    ) -> EvidenceObject:
        """Assemble, verdict, chain-anchor, and store an evidence object."""
        now = datetime.now(timezone.utc)

        if not checks:
            verdict = EvidenceVerdict.UNVERIFIED
        elif any(not c.passed for c in checks):
            verdict = EvidenceVerdict.FAILED
        else:
            # Document review can never produce VERIFIED — that verdict is
            # reserved for authoritative-source confirmation.
            verdict = EvidenceVerdict.REPORTED

        truth_tag = (
            TruthTag.BLOCKED
            if verdict == EvidenceVerdict.FAILED
            else TruthTag.STAGED
        )

        ev = EvidenceObject(
            evidence_id=str(uuid.uuid4()),
            subject_id=subject_id,
            subject_name=subject_name,
            claim=claim,
            credential_type=credential_type,
            verdict=verdict,
            method=VerificationMethod.DOCUMENT_REVIEW,
            truth_tag=truth_tag,
            checks=checks,
            sources=sources,
            evaluated_at=now,
            expires_at=now + timedelta(days=EVIDENCE_TTL_DAYS),
            metadata=metadata,
        )

        rec = self._chain.record(
            actor="cyborg.io",
            actor_type="agent",
            agent_family="Cyborg",
            action=f"evidence_issued:{credential_type.value}:{verdict.value}",
            subject=subject_id,
            approval_type="auto",
            document_ref=ev.evidence_id,
            claim=claim,
        )
        ev.chain_record_id = rec.id
        ev.chain_record_hash = rec.record_hash

        self._evidence[ev.evidence_id] = ev
        self._by_subject.setdefault(subject_id, []).append(ev.evidence_id)
        return ev


# Module-level engine: one evidence store + one hash chain per process,
# mirroring how ProofOfTrust is used elsewhere in the backend.
engine = TrustEngine()
