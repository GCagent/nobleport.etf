"""
NoblePort Projects API

CRUD endpoints for construction project management.
Links to Massachusetts Building Permits smart contract on-chain.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.schemas import (
    DailyLogCreate,
    DailyLogResponse,
    MediaFolderCreate,
    MediaFolderResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    PaginatedResponse,
    SelectionCreate,
    SelectionResponse,
)
from backend.config.database import get_db
from backend.models.daily_log import DailyLog
from backend.models.media import MediaFolder
from backend.models.project import Project, ProjectStatus, ProjectType
from backend.models.selection import Selection, SelectionCategory

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = None,
    project_type: str | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Project)

    if status:
        query = query.where(Project.status == ProjectStatus(status))
    if project_type:
        query = query.where(Project.project_type == ProjectType(project_type))
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Project.name.ilike(search_filter))
            | (Project.address.ilike(search_filter))
            | (Project.city.ilike(search_filter))
        )

    total_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = total_result.scalar()

    query = query.order_by(Project.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    projects = result.scalars().all()

    return PaginatedResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size,
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(
        name=data.name,
        description=data.description,
        project_type=ProjectType(data.project_type),
        budget=data.budget,
        address=data.address,
        city=data.city,
        state=data.state,
        zip_code=data.zip_code,
        parcel_id=data.parcel_id,
        lead_id=data.lead_id,
        project_manager=data.project_manager,
        general_contractor=data.general_contractor,
        municipality=data.municipality,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, data: ProjectUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = ProjectStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return ProjectResponse.model_validate(project)


# --- Daily Logs sub-resource ---

@router.get("/{project_id}/daily-logs", response_model=list[DailyLogResponse])
async def list_daily_logs(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DailyLog)
        .where(DailyLog.project_id == project_id)
        .order_by(DailyLog.log_date.desc())
    )
    logs = result.scalars().all()
    return [DailyLogResponse.model_validate(log) for log in logs]


@router.post(
    "/{project_id}/daily-logs", response_model=DailyLogResponse, status_code=201
)
async def create_daily_log(
    project_id: str, data: DailyLogCreate, db: AsyncSession = Depends(get_db)
):
    log = DailyLog(
        project_id=project_id,
        log_date=data.log_date,
        author=data.author,
        weather=data.weather,
        temperature_high_f=data.temperature_high_f,
        temperature_low_f=data.temperature_low_f,
        weather_delay_hours=data.weather_delay_hours,
        crew_count=data.crew_count,
        subcontractors_on_site=data.subcontractors_on_site,
        total_man_hours=data.total_man_hours,
        work_performed=data.work_performed,
        materials_received=data.materials_received,
        equipment_used=data.equipment_used,
        safety_incidents=data.safety_incidents,
        safety_meeting_held=data.safety_meeting_held,
        visitors=data.visitors,
        inspections_conducted=data.inspections_conducted,
        notes=data.notes,
        issues=data.issues,
        delays=data.delays,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return DailyLogResponse.model_validate(log)


# --- Media Folders sub-resource ---

@router.get("/{project_id}/folders", response_model=list[MediaFolderResponse])
async def list_media_folders(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaFolder).where(MediaFolder.project_id == project_id)
    )
    folders = result.scalars().all()
    return [MediaFolderResponse.model_validate(f) for f in folders]


@router.post(
    "/{project_id}/folders", response_model=MediaFolderResponse, status_code=201
)
async def create_media_folder(
    project_id: str, data: MediaFolderCreate, db: AsyncSession = Depends(get_db)
):
    from backend.models.media import AccessLevel

    folder = MediaFolder(
        project_id=project_id,
        name=data.name,
        description=data.description,
        parent_folder_id=data.parent_folder_id,
        access_level=AccessLevel(data.access_level),
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return MediaFolderResponse.model_validate(folder)


# --- Selections sub-resource ---

@router.get("/{project_id}/selections", response_model=list[SelectionResponse])
async def list_selections(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Selection).where(Selection.project_id == project_id)
    )
    selections = result.scalars().all()
    return [SelectionResponse.model_validate(s) for s in selections]


@router.post(
    "/{project_id}/selections", response_model=SelectionResponse, status_code=201
)
async def create_selection(
    project_id: str, data: SelectionCreate, db: AsyncSession = Depends(get_db)
):
    total = None
    if data.unit_cost and data.quantity:
        total = data.unit_cost * data.quantity

    variance = None
    if total and data.allowance_budget:
        variance = total - data.allowance_budget

    selection = Selection(
        project_id=project_id,
        category=SelectionCategory(data.category),
        name=data.name,
        description=data.description,
        manufacturer=data.manufacturer,
        model_number=data.model_number,
        color_finish=data.color_finish,
        sku=data.sku,
        supplier=data.supplier,
        unit_cost=data.unit_cost,
        quantity=data.quantity,
        total_cost=total,
        allowance_budget=data.allowance_budget,
        variance=variance,
        room_location=data.room_location,
        lead_time_days=data.lead_time_days,
        selected_by=data.selected_by,
        notes=data.notes,
        specification_url=data.specification_url,
    )
    db.add(selection)
    await db.commit()
    await db.refresh(selection)
    return SelectionResponse.model_validate(selection)
