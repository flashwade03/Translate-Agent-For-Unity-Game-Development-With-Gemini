from fastapi import APIRouter, Request
from backend.models import JobHistoryEntry

router = APIRouter(tags=["job_history"])


@router.get("/api/projects/{project_id}/jobs", response_model=list[JobHistoryEntry])
async def list_job_history(
    project_id: str,
    request: Request,
    limit: int = 50,
    offset: int = 0,
):
    history_svc = request.app.state.job_history_service
    rows = await history_svc.list_jobs(project_id, limit, offset)
    return [JobHistoryEntry(**row) for row in rows]
