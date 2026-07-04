"""
NoblePort Jobs API

Job management endpoints with deposit gate enforcement.
Jobs are the execution-phase entities created from won estimates.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import JobResponse, JobUpdate, PaginatedResponse
from backend.config.database import get_db
from backend.models.job import Job, JobStatus
from backend.services.revenue_engine import RevenueEngine

router = APIRouter()
engine = RevenueEngine()


@router.get("", response_model=PaginatedResponse)
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Job)

    if status:
        query = query.where(Job.status == JobStatus(status))

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(Job.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    jobs = result.scalars().all()

    return PaginatedResponse(
        items=[JobResponse.model_validate(j) for j in jobs],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str, data: JobUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = JobStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(job, field, value)

    await db.commit()
    await db.refresh(job)
    return JobResponse.model_validate(job)


@router.post("/{job_id}/activate", response_model=JobResponse)
async def activate_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Activate a job. ENFORCES deposit gate - will reject if deposit not paid.
    """
    try:
        job = await engine.activate_job(job_id, db)
        return JobResponse.model_validate(job)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{job_id}/complete", response_model=JobResponse)
async def complete_job(job_id: str, db: AsyncSession = Depends(get_db)):
    """Mark job as complete and calculate final margin."""
    try:
        job = await engine.complete_job(job_id, db)
        return JobResponse.model_validate(job)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
