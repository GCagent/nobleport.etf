"""Project CRUD routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.project import AuditLog, Project

router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectCreate(BaseModel):
    org_id: str
    name: str
    address: str | None = None
    zoning_district: str | None = None
    lot_area_sf: float | None = None
    frontage_sf: float | None = None
    depth_sf: float | None = None
    lot_width_sf: float | None = None
    source_name: str = "manual"


class ProjectOut(BaseModel):
    id: int
    org_id: str
    name: str
    address: str | None
    zoning_district: str | None
    lot_area_sf: float | None
    frontage_sf: float | None
    depth_sf: float | None
    lot_width_sf: float | None
    source_name: str | None

    model_config = {"from_attributes": True}


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(**body.model_dump())
    db.add(project)
    db.flush()

    db.add(
        AuditLog(
            project_id=project.id,
            action="project.created",
            detail={"name": project.name, "org_id": project.org_id},
        )
    )
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("", response_model=list[ProjectOut])
def list_projects(org_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Project)
    if org_id:
        q = q.filter(Project.org_id == org_id)
    return q.order_by(Project.id.desc()).all()
