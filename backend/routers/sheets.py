from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from backend.models import SheetData, RowUpdate, AddLanguagePayload, CreateSheetPayload, AddRowPayload, DeleteRowsPayload, CsvUploadResult
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




@router.post("/sheets", status_code=201)
async def create_sheet(project_id: str, payload: CreateSheetPayload, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    ok = sheets_svc.create_sheet(project_id, payload.name)
    if not ok:
        raise HTTPException(409, "Sheet already exists")
    return {"ok": True, "name": payload.name}


@router.delete("/sheets/{sheet_name}")
async def delete_sheet(project_id: str, sheet_name: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    # Block deletion if active job exists on this sheet
    job_svc = request.app.state.job_service
    active_jobs = [
        j for j in job_svc._jobs.values()
        if j.project_id == project_id
        and j.sheet_name == sheet_name
        and j.status in ("pending", "running")
    ]
    if active_jobs:
        raise HTTPException(409, "Cannot delete sheet with active translation jobs")

    sheets_svc = request.app.state.sheets_service
    key_count = sheets_svc.delete_sheet(project_id, sheet_name)
    if key_count < 0:
        raise HTTPException(404, "Sheet not found")
    return {"ok": True, "deletedKeys": key_count}

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


@router.get("/sheets/{sheet_name}/export")
async def export_sheet(project_id: str, sheet_name: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    csv_path = sheets_svc.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
    if not csv_path.exists():
        raise HTTPException(404, "Sheet not found")
    return FileResponse(
        path=str(csv_path),
        media_type="text/csv",
        filename=f"{sheet_name}.csv",
    )


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




@router.post("/sheets/{sheet_name}/rows", status_code=201)
async def add_row(project_id: str, sheet_name: str, payload: AddRowPayload, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    ok = sheets_svc.add_row(project_id, sheet_name, payload.key)
    if not ok:
        raise HTTPException(409, "Key already exists or sheet not found")
    return {"ok": True, "key": payload.key}



@router.delete("/sheets/{sheet_name}/rows")
async def delete_rows(project_id: str, sheet_name: str, payload: DeleteRowsPayload, request: Request):
    # Block deletion if active job exists on this sheet
    job_svc = request.app.state.job_service
    active_jobs = [
        j for j in job_svc._jobs.values()
        if j.project_id == project_id
        and j.sheet_name == sheet_name
        and j.status in ("pending", "running")
    ]
    if active_jobs:
        raise HTTPException(409, "Cannot delete rows with active translation jobs")

    sheets_svc = request.app.state.sheets_service
    deleted = sheets_svc.delete_rows(project_id, sheet_name, payload.keys)
    return {"ok": True, "deletedCount": deleted}


@router.post("/sheets/{sheet_name}/upload", response_model=CsvUploadResult)
async def upload_csv(
    project_id: str,
    sheet_name: str,
    request: Request,
    file: UploadFile = File(...),
):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    sheets_svc = request.app.state.sheets_service
    config_svc = request.app.state.config_service

    content = await file.read()
    try:
        csv_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded")

    try:
        result = sheets_svc.merge_csv(
            project_id, sheet_name, csv_content, config_service=config_svc
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    return result


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
