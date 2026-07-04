"""
NoblePort Estimates API

CRUD + lifecycle endpoints for the estimate pipeline.
Handles create, send, approve, lose, and revision workflows.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    EstimateCreate,
    EstimateResponse,
    EstimateUpdate,
    PaginatedResponse,
)
from backend.config.database import get_db
from backend.models.estimate import Estimate, EstimateStatus
from backend.services.revenue_engine import RevenueEngine

router = APIRouter()
engine = RevenueEngine()


@router.get("", response_model=PaginatedResponse)
async def list_estimates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    lead_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Estimate)

    if status:
        query = query.where(Estimate.status == EstimateStatus(status))
    if lead_id:
        query = query.where(Estimate.lead_id == lead_id)

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(Estimate.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    estimates = result.scalars().all()

    return PaginatedResponse(
        items=[EstimateResponse.model_validate(e) for e in estimates],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{estimate_id}", response_model=EstimateResponse)
async def get_estimate(estimate_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Estimate).where(Estimate.id == estimate_id)
    )
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")
    return EstimateResponse.model_validate(estimate)


@router.post("", response_model=EstimateResponse, status_code=201)
async def create_estimate(data: EstimateCreate, db: AsyncSession = Depends(get_db)):
    try:
        estimate = await engine.create_estimate(
            lead_id=data.lead_id,
            estimate_number=data.estimate_number,
            project_name=data.project_name,
            base_value=data.base_value,
            markup_percent=data.markup_percent,
            deposit_percent=data.deposit_percent,
            db=db,
            scope_description=data.scope_description,
            job_type=data.job_type,
            win_probability=data.win_probability,
            notes=data.notes,
        )
        return EstimateResponse.model_validate(estimate)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{estimate_id}", response_model=EstimateResponse)
async def update_estimate(
    estimate_id: str,
    data: EstimateUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Estimate).where(Estimate.id == estimate_id)
    )
    estimate = result.scalar_one_or_none()
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    update_data = data.model_dump(exclude_unset=True)

    # Recalculate financials if base_value or markup changed
    recalc = False
    if "base_value" in update_data:
        estimate.base_value = update_data.pop("base_value")
        recalc = True
    if "markup_percent" in update_data:
        estimate.markup_percent = update_data.pop("markup_percent")
        recalc = True
    if "deposit_percent" in update_data:
        estimate.deposit_percent = update_data.pop("deposit_percent")
        recalc = True

    if recalc:
        estimate.markup_amount = estimate.base_value * (estimate.markup_percent / 100)
        estimate.total_value = estimate.base_value + estimate.markup_amount
        estimate.deposit_amount = estimate.total_value * (estimate.deposit_percent / 100)

    if "status" in update_data:
        update_data["status"] = EstimateStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(estimate, field, value)

    await db.commit()
    await db.refresh(estimate)
    return EstimateResponse.model_validate(estimate)


@router.post("/{estimate_id}/send", response_model=EstimateResponse)
async def send_estimate(estimate_id: str, db: AsyncSession = Depends(get_db)):
    """Mark estimate as sent to client."""
    try:
        estimate = await engine.send_estimate(estimate_id, db)
        return EstimateResponse.model_validate(estimate)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{estimate_id}/approve")
async def approve_estimate(estimate_id: str, db: AsyncSession = Depends(get_db)):
    """
    Client approves estimate -> auto-creates job with deposit gate.
    This is the critical pipeline transition.
    """
    try:
        result = await engine.approve_estimate(estimate_id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{estimate_id}/lose", response_model=EstimateResponse)
async def lose_estimate(
    estimate_id: str,
    reason: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Mark estimate as lost."""
    try:
        estimate = await engine.lose_estimate(estimate_id, db, reason)
        return EstimateResponse.model_validate(estimate)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
