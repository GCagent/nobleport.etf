"""
Cyborg.io Trust Engine API

Verification and trust endpoints — every response is an evidence object
(what was claimed, what was checked, what the checks found, and the
hash-chain anchor proving when), never a bare pass/fail.

    POST /api/cyborg/verify/license    MA CSL / HIC from submitted documents
    POST /api/cyborg/verify/insurance  GL certificate of insurance
    POST /api/cyborg/policy/evaluate   Policy decision over stored evidence
    GET  /api/cyborg/policies          Available policies
    GET  /api/cyborg/evidence/{id}     Retrieve an evidence object
    GET  /api/cyborg/evidence/{id}/proof  Hash-chain proof for the evidence
    GET  /api/cyborg/subjects/{id}/evidence  All evidence for a subject
    GET  /api/cyborg/subjects/{id}/trust-score  Scored trust with breakdown

Truth-Layer honesty: with no registry adapters connected, verdicts top out
at REPORTED and policy decisions at CONDITIONAL (STAGED — human review
required). APPROVED/LIVE becomes reachable only with authoritative-source
lookups.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.services.trust_engine import POLICIES, engine

router = APIRouter()


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------


class LicenseVerifyRequest(BaseModel):
    subject_id: str = Field(..., description="Canonical entity ID (vendor, sub)")
    subject_name: str
    license_number: str
    license_type: str = Field("ma_csl", description="ma_csl | ma_hic")
    holder_name: str | None = None
    expiration_date: date | None = None


class InsuranceVerifyRequest(BaseModel):
    subject_id: str
    subject_name: str
    carrier: str
    policy_number: str
    each_occurrence: float
    effective_date: date | None = None
    expiration_date: date | None = None
    min_coverage: float = 1_000_000.0


class PolicyEvaluateRequest(BaseModel):
    policy: str = Field(..., description="e.g. subcontractor_onboarding")
    subject_id: str


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


@router.post("/verify/license")
async def verify_license(body: LicenseVerifyRequest):
    try:
        evidence = engine.verify_license(
            subject_id=body.subject_id,
            subject_name=body.subject_name,
            license_number=body.license_number,
            license_type=body.license_type,
            holder_name=body.holder_name,
            expiration_date=body.expiration_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return evidence.as_dict()


@router.post("/verify/insurance")
async def verify_insurance(body: InsuranceVerifyRequest):
    evidence = engine.verify_insurance(
        subject_id=body.subject_id,
        subject_name=body.subject_name,
        carrier=body.carrier,
        policy_number=body.policy_number,
        each_occurrence=body.each_occurrence,
        effective_date=body.effective_date,
        expiration_date=body.expiration_date,
        min_coverage=body.min_coverage,
    )
    return evidence.as_dict()


# ---------------------------------------------------------------------------
# Policy engine
# ---------------------------------------------------------------------------


@router.get("/policies")
async def list_policies():
    return {
        name: {
            "description": p.description,
            "requirements": [
                {
                    "credential_type": r.credential_type.value,
                    "min_coverage": r.min_coverage,
                    "description": r.description,
                }
                for r in p.requirements
            ],
        }
        for name, p in POLICIES.items()
    }


@router.post("/policy/evaluate")
async def evaluate_policy(body: PolicyEvaluateRequest):
    try:
        evaluation = engine.evaluate_policy(body.policy, body.subject_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return evaluation.as_dict()


# ---------------------------------------------------------------------------
# Evidence access
# ---------------------------------------------------------------------------


@router.get("/evidence/{evidence_id}")
async def get_evidence(evidence_id: str):
    try:
        return engine.get_evidence(evidence_id).as_dict()
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/evidence/{evidence_id}/proof")
async def get_evidence_proof(evidence_id: str):
    try:
        return engine.chain_proof(evidence_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/subjects/{subject_id}/evidence")
async def get_subject_evidence(subject_id: str):
    return {
        "subject_id": subject_id,
        "evidence": [ev.as_dict() for ev in engine.evidence_for_subject(subject_id)],
        "chain_intact": engine.verify_chain(),
    }


@router.get("/subjects/{subject_id}/trust-score")
async def get_trust_score(subject_id: str):
    return engine.trust_score(subject_id)
