import re
from fastapi import APIRouter, HTTPException, Request
from backend.services.gws_service import GwsError, GwsAuthError

router = APIRouter(prefix="/api/projects/{project_id}", tags=["translations"])


@router.get("/sheets/{sheet_name}/pending")
async def get_pending_translations(project_id: str, sheet_name: str, request: Request):
    pending_svc = request.app.state.pending_translations_service
    items = await pending_svc.get_pending(project_id, sheet_name)
    return {"items": items, "count": len(items)}


@router.get("/sheets/{sheet_name}/pending/count")
async def get_pending_count(project_id: str, sheet_name: str, request: Request):
    pending_svc = request.app.state.pending_translations_service
    count = await pending_svc.get_pending_count(project_id, sheet_name)
    return {"count": count}


@router.post("/sheets/{sheet_name}/apply")
async def apply_translations(project_id: str, sheet_name: str, request: Request):
    """Apply pending translations to Google Sheets."""
    config_svc = request.app.state.config_service
    cfg = config_svc._read_config(project_id)
    source = cfg.get("source", "csv")
    spreadsheet_id = cfg.get("spreadsheet_id")

    if source != "gws":
        raise HTTPException(400, "Apply is only available for Google Sheets projects")
    if not spreadsheet_id:
        raise HTTPException(400, "Project has no spreadsheet_id configured")

    pending_svc = request.app.state.pending_translations_service
    gws_svc = request.app.state.gws_service

    items = await pending_svc.get_pending(project_id, sheet_name)
    if not items:
        return {"applied": 0, "message": "No pending translations"}

    # Read current sheet to build cell position map
    sheet_data = await gws_svc.read_tab(spreadsheet_id, sheet_name)

    # Build key -> row_index and lang_code -> col_index maps
    key_index = {row["key"]: i for i, row in enumerate(sheet_data.rows)}
    col_index = {}
    for i, h in enumerate(sheet_data.headers[1:], start=1):
        m = re.match(r".+\(([^)]+)\)", h)
        if m:
            col_index[m.group(1)] = i

    # Convert pending items to positional updates
    updates = []
    skipped = 0
    for item in items:
        row_idx = key_index.get(item["key"])
        col_idx = col_index.get(item["lang_code"])
        if row_idx is not None and col_idx is not None:
            updates.append({
                "key": item["key"],
                "lang_code": item["lang_code"],
                "value": item["value"],
                "row_index": row_idx,
                "col_index": col_idx,
            })
        else:
            skipped += 1

    if not updates:
        return {"applied": 0, "skipped": skipped, "message": "No matching cells found"}

    try:
        updated = await gws_svc.batch_update(spreadsheet_id, sheet_name, updates)
    except GwsAuthError as e:
        raise HTTPException(401, f"Google Sheets authentication error: {e}")
    except GwsError as e:
        raise HTTPException(502, f"Google Sheets update failed: {e}")

    # Mark as applied only after successful write
    await pending_svc.mark_applied(project_id, sheet_name)

    return {"applied": updated, "skipped": skipped}


@router.delete("/sheets/{sheet_name}/pending")
async def discard_pending(project_id: str, sheet_name: str, request: Request):
    pending_svc = request.app.state.pending_translations_service
    discarded = await pending_svc.discard_pending(project_id, sheet_name)
    return {"discarded": discarded}
