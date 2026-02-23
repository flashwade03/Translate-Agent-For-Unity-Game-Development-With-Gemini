from fastapi import APIRouter, HTTPException, Request
from backend.models import SheetData, RowUpdate
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["sheets"])
project_service = ProjectService()


@router.get("/sheets", response_model=list[str])
async def list_sheets(project_id: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    return await sheets_svc.list_sheets(project.spreadsheet_id)


@router.get("/sheets/{sheet_name}", response_model=SheetData)
async def get_sheet_data(project_id: str, sheet_name: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    data = await sheets_svc.get_sheet_data(project.spreadsheet_id, sheet_name)
    if not data:
        raise HTTPException(404, "Sheet not found")
    return data


@router.put("/sheets/{sheet_name}/rows")
async def update_rows(project_id: str, sheet_name: str, updates: list[RowUpdate], request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    await sheets_svc.update_cells(
        project.spreadsheet_id,
        sheet_name,
        [u.model_dump() for u in updates],
    )
    return {"ok": True}
