"""
NoblePort Proof of Trust API

Provides read-only endpoints for querying the tamper-evident audit trail.
Every action in NoblePort (human or AI) is recorded as a hash-chained
TrustRecord. These endpoints let operators inspect, verify, and prove
the integrity of any action.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config.database import get_db
from backend.models.trust_record import TrustApprovalType, TrustRecord

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TrustRecordResponse(BaseModel):
    id: str
    actor: str
    actor_type: str
    agent_family: str | None
    action: str
    subject_type: str
    subject_id: str
    detail: str
    approval_type: str
    approved_by: str | None
    approval_reason: str | None
    ai_suggested: bool
    ai_suggestion: str | None
    ai_confidence: float | None
    human_overrode_ai: bool
    document_ref: str | None
    document_hash: str | None
    payment_id: str | None
    payment_amount: float | None
    record_hash: str
    prev_hash: str
    chain_anchor: str | None
    status: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ChainVerification(BaseModel):
    record_id: str
    record_hash: str
    prev_hash: str
    chain_valid: bool
    chain_length: int
    breaks: list[dict[str, Any]]


class TrustProof(BaseModel):
    record: TrustRecordResponse
    chain: list[TrustRecordResponse]
    verification: ChainVerification


class TrustStats(BaseModel):
    total_records: int
    by_status: dict[str, int]
    by_actor_type: dict[str, int]
    by_approval_type: dict[str, int]
    ai_suggested_count: int
    human_override_count: int
    chain_anchored_count: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/trail/{subject_id}", response_model=list[TrustRecordResponse])
async def get_audit_trail(
    subject_id: str,
    subject_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get the full audit trail for a subject (lead, job, payment, etc.)."""
    query = select(TrustRecord).where(TrustRecord.subject_id == subject_id)

    if subject_type:
        query = query.where(TrustRecord.subject_type == subject_type)
    if action:
        query = query.where(TrustRecord.action == action)

    query = query.order_by(TrustRecord.created_at.asc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    records = result.scalars().all()
    return [TrustRecordResponse.model_validate(r) for r in records]


@router.get("/record/{record_id}", response_model=TrustRecordResponse)
async def get_trust_record(
    record_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single trust record by ID."""
    result = await db.execute(
        select(TrustRecord).where(TrustRecord.id == record_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Trust record not found")
    return TrustRecordResponse.model_validate(record)


@router.get("/verify/{record_id}", response_model=ChainVerification)
async def verify_chain_integrity(
    record_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify hash-chain integrity backwards from a given record.
    Walks the prev_hash links and checks each record's hash matches.
    """
    # Fetch the target record
    result = await db.execute(
        select(TrustRecord).where(TrustRecord.id == record_id)
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Trust record not found")

    # Walk the chain backwards via prev_hash
    chain: list[TrustRecord] = [target]
    breaks: list[dict[str, Any]] = []
    current = target

    while current.prev_hash and current.prev_hash != "genesis":
        result = await db.execute(
            select(TrustRecord).where(
                TrustRecord.record_hash == current.prev_hash
            )
        )
        prev = result.scalar_one_or_none()
        if not prev:
            breaks.append({
                "at_record": current.id,
                "expected_prev_hash": current.prev_hash,
                "reason": "previous record not found",
            })
            break
        chain.append(prev)
        current = prev

        # Safety: cap chain walk at 1000 records
        if len(chain) >= 1000:
            break

    return ChainVerification(
        record_id=record_id,
        record_hash=target.record_hash,
        prev_hash=target.prev_hash,
        chain_valid=len(breaks) == 0,
        chain_length=len(chain),
        breaks=breaks,
    )


@router.get("/proof/{action_id}", response_model=TrustProof)
async def get_proof_of_trust(
    action_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get complete proof of trust for a record: the record itself, the
    chain of records for its subject, and chain verification.
    """
    # Fetch the target record
    result = await db.execute(
        select(TrustRecord).where(TrustRecord.id == action_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Trust record not found")

    # Fetch all records for the same subject
    chain_result = await db.execute(
        select(TrustRecord)
        .where(TrustRecord.subject_id == record.subject_id)
        .where(TrustRecord.subject_type == record.subject_type)
        .order_by(TrustRecord.created_at.asc())
    )
    chain_records = chain_result.scalars().all()

    # Verify chain continuity for this subject's records
    breaks: list[dict[str, Any]] = []
    for i in range(1, len(chain_records)):
        if chain_records[i].prev_hash != chain_records[i - 1].record_hash:
            breaks.append({
                "at_record": chain_records[i].id,
                "expected_prev_hash": chain_records[i].prev_hash,
                "actual_prev_hash": chain_records[i - 1].record_hash,
                "reason": "hash mismatch",
            })

    verification = ChainVerification(
        record_id=action_id,
        record_hash=record.record_hash,
        prev_hash=record.prev_hash,
        chain_valid=len(breaks) == 0,
        chain_length=len(chain_records),
        breaks=breaks,
    )

    return TrustProof(
        record=TrustRecordResponse.model_validate(record),
        chain=[TrustRecordResponse.model_validate(r) for r in chain_records],
        verification=verification,
    )


@router.get("/stats", response_model=TrustStats)
async def get_trust_stats(
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate statistics for the trust layer."""
    # Total records
    total_result = await db.execute(select(func.count(TrustRecord.id)))
    total = total_result.scalar() or 0

    # By status
    status_result = await db.execute(
        select(TrustRecord.status, func.count(TrustRecord.id))
        .group_by(TrustRecord.status)
    )
    by_status = {row[0]: row[1] for row in status_result.all()}

    # By actor type
    actor_result = await db.execute(
        select(TrustRecord.actor_type, func.count(TrustRecord.id))
        .group_by(TrustRecord.actor_type)
    )
    by_actor_type = {row[0]: row[1] for row in actor_result.all()}

    # By approval type
    approval_result = await db.execute(
        select(TrustRecord.approval_type, func.count(TrustRecord.id))
        .group_by(TrustRecord.approval_type)
    )
    by_approval_type = {str(row[0].value) if hasattr(row[0], 'value') else str(row[0]): row[1] for row in approval_result.all()}

    # AI stats
    ai_result = await db.execute(
        select(func.count(TrustRecord.id)).where(TrustRecord.ai_suggested == True)
    )
    ai_suggested_count = ai_result.scalar() or 0

    override_result = await db.execute(
        select(func.count(TrustRecord.id)).where(TrustRecord.human_overrode_ai == True)
    )
    human_override_count = override_result.scalar() or 0

    # Chain anchored
    anchor_result = await db.execute(
        select(func.count(TrustRecord.id)).where(TrustRecord.chain_anchor.isnot(None))
    )
    chain_anchored_count = anchor_result.scalar() or 0

    return TrustStats(
        total_records=total,
        by_status=by_status,
        by_actor_type=by_actor_type,
        by_approval_type=by_approval_type,
        ai_suggested_count=ai_suggested_count,
        human_override_count=human_override_count,
        chain_anchored_count=chain_anchored_count,
    )
