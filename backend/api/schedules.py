"""
NoblePort Schedules API

CRUD endpoints for construction schedule and task management.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    PaginatedResponse,
    ScheduleItemCreate,
    ScheduleItemResponse,
    ScheduleItemUpdate,
)
from backend.config.database import get_db
from backend.models.schedule import ScheduleItem, TaskPriority, TaskStatus

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_schedule_items(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    project_id: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    assigned_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ScheduleItem)

    if project_id:
        query = query.where(ScheduleItem.project_id == project_id)
    if status:
        query = query.where(ScheduleItem.status == TaskStatus(status))
    if priority:
        query = query.where(ScheduleItem.priority == TaskPriority(priority))
    if assigned_to:
        query = query.where(ScheduleItem.assigned_to == assigned_to)

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(ScheduleItem.scheduled_start.asc().nullslast())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return PaginatedResponse(
        items=[ScheduleItemResponse.model_validate(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{item_id}", response_model=ScheduleItemResponse)
async def get_schedule_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduleItem).where(ScheduleItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    return ScheduleItemResponse.model_validate(item)


@router.post("", response_model=ScheduleItemResponse, status_code=201)
async def create_schedule_item(
    data: ScheduleItemCreate, db: AsyncSession = Depends(get_db)
):
    item = ScheduleItem(
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        priority=TaskPriority(data.priority),
        scheduled_start=data.scheduled_start,
        scheduled_end=data.scheduled_end,
        assigned_to=data.assigned_to,
        trade=data.trade,
        depends_on_id=data.depends_on_id,
        requires_inspection=data.requires_inspection,
        inspection_type=data.inspection_type,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ScheduleItemResponse.model_validate(item)


@router.patch("/{item_id}", response_model=ScheduleItemResponse)
async def update_schedule_item(
    item_id: str, data: ScheduleItemUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ScheduleItem).where(ScheduleItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Schedule item not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = TaskStatus(update_data["status"])
    if "priority" in update_data:
        update_data["priority"] = TaskPriority(update_data["priority"])

    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)
    return ScheduleItemResponse.model_validate(item)


@router.delete("/{item_id}", status_code=204)
async def delete_schedule_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScheduleItem).where(ScheduleItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Schedule item not found")
    await db.delete(item)
    await db.commit()
