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
    return sheets_svc.list_sheets(project_id)


@router.get("/sheets/{sheet_name}", response_model=SheetData)
async def get_sheet_data(project_id: str, sheet_name: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    data = sheets_svc.get_sheet_data(project_id, sheet_name)
    if not data:
        raise HTTPException(404, "Sheet not found")
    return data


@router.put("/sheets/{sheet_name}/rows")
async def update_rows(project_id: str, sheet_name: str, updates: list[RowUpdate], request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    sheets_svc.update_cells(
        project_id,
        sheet_name,
        [u.model_dump() for u in updates],
    )
    return {"ok": True}


from backend.models import AddLanguagePayload


@router.post("/sheets/{sheet_name}/languages", status_code=201)
async def add_language(
    project_id: str,
    sheet_name: str,
    payload: AddLanguagePayload,
    request: Request,
):
    sheets_svc = request.app.state.sheets_service
    ok = sheets_svc.add_language(project_id, sheet_name, payload.code, payload.label)
    if not ok:
        raise HTTPException(400, "Failed to add language. It may already exist.")
    return {"ok": True, "code": payload.code, "label": payload.label}


@router.delete("/sheets/{sheet_name}/languages/{code}")
async def delete_language(
    project_id: str,
    sheet_name: str,
    code: str,
    request: Request,
):
    sheets_svc = request.app.state.sheets_service
    deleted_count = sheets_svc.delete_language(project_id, sheet_name, code)
    if deleted_count < 0:
        raise HTTPException(404, "Language not found in this sheet.")
    return {"ok": True, "deletedTranslations": deleted_count}
