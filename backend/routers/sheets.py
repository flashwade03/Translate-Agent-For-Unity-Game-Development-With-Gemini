import csv
import io
import re

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from backend.models import SheetData, RowUpdate, AddLanguagePayload, CreateSheetPayload, AddRowPayload, DeleteRowsPayload, CsvUploadResult
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["sheets"])
project_service = ProjectService()

# Prevent path traversal: only allow safe characters in identifiers
_SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9_\- .]+$")


def _validate_names(project_id: str, sheet_name: str | None = None) -> None:
    """Validate project_id and sheet_name to prevent path traversal."""
    if not _SAFE_NAME_RE.match(project_id):
        raise HTTPException(400, "Invalid project ID")
    if sheet_name is not None and not _SAFE_NAME_RE.match(sheet_name):
        raise HTTPException(400, "Invalid sheet name")


def _get_project_source(request: Request, project_id: str) -> tuple[str, str | None]:
    """Return (source_type, spreadsheet_id) for a project."""
    config_svc = request.app.state.config_service
    cfg = config_svc._read_config(project_id)
    return cfg.get("source", "csv"), cfg.get("spreadsheet_id")


@router.get("/sheets", response_model=list[str])
async def list_sheets(project_id: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    source, spreadsheet_id = _get_project_source(request, project_id)
    if source == "gws":
        if not spreadsheet_id:
            raise HTTPException(400, "Project has no spreadsheet_id configured")
        gws_svc = request.app.state.gws_service
        return await gws_svc.list_tabs(spreadsheet_id)

    sheets_svc = request.app.state.sheets_service
    return sheets_svc.list_sheets(project_id)


@router.post("/sheets", status_code=201)
async def create_sheet(project_id: str, payload: CreateSheetPayload, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    source, _ = _get_project_source(request, project_id)
    if source == "gws":
        raise HTTPException(403, "Sheet management is controlled by Google Sheets")

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

    source, _ = _get_project_source(request, project_id)
    if source == "gws":
        raise HTTPException(403, "Sheet management is controlled by Google Sheets")

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
    _validate_names(project_id, sheet_name)
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    source, spreadsheet_id = _get_project_source(request, project_id)
    if source == "gws":
        if not spreadsheet_id:
            raise HTTPException(400, "Project has no spreadsheet_id configured")
        gws_svc = request.app.state.gws_service
        return await gws_svc.read_tab(spreadsheet_id, sheet_name)

    sheets_svc = request.app.state.sheets_service
    data = sheets_svc.get_sheet_data(project_id, sheet_name)
    if not data:
        raise HTTPException(404, "Sheet not found")
    return data


@router.get("/sheets/{sheet_name}/export")
async def export_sheet(project_id: str, sheet_name: str, request: Request):
    _validate_names(project_id, sheet_name)
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    source, spreadsheet_id = _get_project_source(request, project_id)
    if source == "gws":
        if not spreadsheet_id:
            raise HTTPException(400, "Project has no spreadsheet_id configured")
        gws_svc = request.app.state.gws_service
        sheet_data = await gws_svc.read_tab(spreadsheet_id, sheet_name)
        # Convert SheetData to CSV format
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(sheet_data.headers)
        for row in sheet_data.rows:
            csv_row = [row.get("key", "")]
            for lang in sheet_data.languages:
                csv_row.append(row.get(lang.code, ""))
            writer.writerow(csv_row)
        csv_bytes = output.getvalue().encode("utf-8")
        return StreamingResponse(
            io.BytesIO(csv_bytes),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{sheet_name}.csv"'},
        )

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
    _validate_names(project_id, sheet_name)
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    source, _ = _get_project_source(request, project_id)
    if source == "gws":
        # For gws projects, redirect to pending_translations_service
        pending_svc = request.app.state.pending_translations_service
        if not pending_svc:
            raise HTTPException(503, "PendingTranslationsService not available")
        translations = [
            {"key": u.key, "lang_code": u.lang_code, "value": u.value}
            for u in updates
        ]
        saved = await pending_svc.save_translations(
            project_id, sheet_name, translations, source="user_edit"
        )
        return {"ok": True, "pending": saved}

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

    source, _ = _get_project_source(request, project_id)
    if source == "gws":
        raise HTTPException(403, "Row management is controlled by Google Sheets")

    sheets_svc = request.app.state.sheets_service
    ok = sheets_svc.add_row(project_id, sheet_name, payload.key)
    if not ok:
        raise HTTPException(409, "Key already exists or sheet not found")
    return {"ok": True, "key": payload.key}


@router.delete("/sheets/{sheet_name}/rows")
async def delete_rows(project_id: str, sheet_name: str, payload: DeleteRowsPayload, request: Request):
    source, _ = _get_project_source(request, project_id)
    if source == "gws":
        raise HTTPException(403, "Row management is controlled by Google Sheets")

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
    _validate_names(project_id, sheet_name)
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    source, _ = _get_project_source(request, project_id)
    if source == "gws":
        raise HTTPException(403, "CSV upload not available for Google Sheets projects")

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
