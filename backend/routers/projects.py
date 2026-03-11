from fastapi import APIRouter, HTTPException
from backend.models import Project, CreateProjectPayload
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])
service = ProjectService()


@router.get("", response_model=list[Project])
async def list_projects():
    return service.list_projects()


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    p = service.get_project(project_id)
    if not p:
        raise HTTPException(404, f"Project '{project_id}' not found")
    return p


@router.post("", response_model=Project, status_code=201)
async def create_project(payload: CreateProjectPayload):
    return service.create_project(
        payload.name,
        payload.description,
        source_type=payload.source_type.value,
        spreadsheet_id=payload.spreadsheet_id,
    )


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if not service.delete_project(project_id):
        raise HTTPException(404, f"Project '{project_id}' not found")
    return {"ok": True}
