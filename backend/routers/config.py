from fastapi import APIRouter, HTTPException
from backend.models import (
    SheetSettings, Glossary, GlossaryEntry, GlossaryEntryCreate, StyleGuide,
)
from backend.services.config_service import ConfigService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["config"])
service = ConfigService()


# --- Sheet Settings ---

@router.get("/sheets/{sheet_name}/settings", response_model=SheetSettings)
async def get_sheet_settings(project_id: str, sheet_name: str):
    return service.get_sheet_settings(project_id, sheet_name)


@router.put("/sheets/{sheet_name}/settings", response_model=SheetSettings)
async def update_sheet_settings(project_id: str, sheet_name: str, settings: SheetSettings):
    return service.update_sheet_settings(project_id, sheet_name, settings)


# --- Glossary ---

@router.get("/glossary", response_model=Glossary)
async def get_glossary(project_id: str):
    return service.get_glossary(project_id)


@router.post("/glossary", response_model=GlossaryEntry, status_code=201)
async def add_glossary_entry(project_id: str, entry: GlossaryEntryCreate):
    return service.add_glossary_entry(project_id, entry)


@router.put("/glossary/{entry_id}", response_model=GlossaryEntry)
async def update_glossary_entry(project_id: str, entry_id: str, updates: dict):
    result = service.update_glossary_entry(project_id, entry_id, updates)
    if not result:
        raise HTTPException(404, "Entry not found")
    return result


@router.delete("/glossary/{entry_id}")
async def delete_glossary_entry(project_id: str, entry_id: str):
    if not service.delete_glossary_entry(project_id, entry_id):
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


# --- Style Guide ---

@router.get("/style-guide", response_model=StyleGuide)
async def get_style_guide(project_id: str):
    return service.get_style_guide(project_id)


@router.put("/style-guide", response_model=StyleGuide)
async def update_style_guide(project_id: str, guide: StyleGuide):
    return service.update_style_guide(project_id, guide)
