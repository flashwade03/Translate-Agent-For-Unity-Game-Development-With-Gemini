from fastapi import APIRouter, HTTPException, Request
from backend.models import AddLanguagePayload, ProjectLanguage
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["languages"])
project_service = ProjectService()


@router.get("/languages", response_model=list[ProjectLanguage])
async def list_project_languages(project_id: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    return config_svc.get_project_languages(project_id)


@router.post("/languages", status_code=201, response_model=ProjectLanguage)
async def add_project_language(project_id: str, payload: AddLanguagePayload, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    lang = config_svc.add_project_language(project_id, payload.code, payload.label)
    if lang is None:
        raise HTTPException(409, "Language already exists")
    return lang


@router.delete("/languages/{code}")
async def delete_project_language(project_id: str, code: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    ok = config_svc.delete_project_language(project_id, code)
    if not ok:
        raise HTTPException(404, "Language not found")

    # Sync: remove column from all sheet CSVs
    sheets_svc = request.app.state.sheets_service
    stats = sheets_svc.delete_language_from_all_sheets(project_id, code)

    return {
        "ok": True,
        "affectedSheets": stats["affected_sheets"],
        "affectedTranslations": stats["affected_translations"],
    }
