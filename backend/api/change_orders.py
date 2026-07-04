"""
NoblePort Change Orders (AWO) API

Additional Work Order management - the profit multiplier module.
Every scope change mid-project flows through here.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    ChangeOrderCreate,
    ChangeOrderResponse,
    ChangeOrderUpdate,
    PaginatedResponse,
)
from backend.config.database import get_db
from backend.models.change_order import ChangeOrder, ChangeOrderStatus
from backend.services.revenue_engine import RevenueEngine

router = APIRouter()
engine = RevenueEngine()


@router.get("", response_model=PaginatedResponse)
async def list_change_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    job_id: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ChangeOrder)

    if job_id:
        query = query.where(ChangeOrder.job_id == job_id)
    if status:
        query = query.where(ChangeOrder.status == ChangeOrderStatus(status))

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(ChangeOrder.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    orders = result.scalars().all()

    return PaginatedResponse(
        items=[ChangeOrderResponse.model_validate(co) for co in orders],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{change_order_id}", response_model=ChangeOrderResponse)
async def get_change_order(
    change_order_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChangeOrder).where(ChangeOrder.id == change_order_id)
    )
    co = result.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")
    return ChangeOrderResponse.model_validate(co)


@router.post("", response_model=ChangeOrderResponse, status_code=201)
async def create_change_order(
    data: ChangeOrderCreate, db: AsyncSession = Depends(get_db)
):
    """Create a new change order (AWO) for a job."""
    try:
        co = await engine.create_change_order(
            job_id=data.job_id,
            title=data.title,
            description=data.description or "",
            labor_cost=data.labor_cost,
            material_cost=data.material_cost,
            markup_percent=data.markup_percent,
            reason=data.reason,
            db=db,
            schedule_impact_days=data.schedule_impact_days,
            requires_deposit=data.requires_deposit,
            deposit_percent=data.deposit_percent,
        )

        # Calculate deposit amount if required
        if co.requires_deposit and co.deposit_percent > 0:
            co.deposit_amount = co.total_amount * (co.deposit_percent / 100)
            await db.commit()
            await db.refresh(co)

        return ChangeOrderResponse.model_validate(co)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{change_order_id}", response_model=ChangeOrderResponse)
async def update_change_order(
    change_order_id: str,
    data: ChangeOrderUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChangeOrder).where(ChangeOrder.id == change_order_id)
    )
    co = result.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")

    update_data = data.model_dump(exclude_unset=True)

    # Recalculate if costs changed
    recalc = False
    if "labor_cost" in update_data:
        co.labor_cost = update_data.pop("labor_cost")
        recalc = True
    if "material_cost" in update_data:
        co.material_cost = update_data.pop("material_cost")
        recalc = True
    if "markup_percent" in update_data:
        co.markup_percent = update_data.pop("markup_percent")
        recalc = True

    if recalc:
        base = co.labor_cost + co.material_cost
        co.markup_amount = base * (co.markup_percent / 100)
        co.total_amount = base + co.markup_amount

    if "status" in update_data:
        update_data["status"] = ChangeOrderStatus(update_data["status"])
    if "reason" in update_data:
        from backend.models.change_order import ChangeOrderReason
        update_data["reason"] = ChangeOrderReason(update_data["reason"])

    for field, value in update_data.items():
        setattr(co, field, value)

    await db.commit()
    await db.refresh(co)
    return ChangeOrderResponse.model_validate(co)


@router.post("/{change_order_id}/approve", response_model=ChangeOrderResponse)
async def approve_change_order(
    change_order_id: str,
    approved_by: str = "owner",
    db: AsyncSession = Depends(get_db),
):
    """Approve a change order and update job contract value."""
    try:
        co = await engine.approve_change_order(change_order_id, approved_by, db)
        return ChangeOrderResponse.model_validate(co)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
