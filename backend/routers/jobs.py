from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from backend.models import TranslationJob, JobCreatePayload, ReviewReport, JobStatus

router = APIRouter(tags=["jobs"])


@router.post("/api/projects/{project_id}/sheets/{sheet_name}/jobs", response_model=TranslationJob, status_code=201)
async def create_job(
    project_id: str,
    sheet_name: str,
    payload: JobCreatePayload,
    background_tasks: BackgroundTasks,
    request: Request,
):
    job_svc = request.app.state.job_service
    job = job_svc.create_job(project_id, sheet_name, payload.type.value)

    # Schedule agent execution in background
    background_tasks.add_task(run_agent_job, request.app, job.job_id)

    return job


@router.get("/api/jobs/{job_id}", response_model=TranslationJob)
async def get_job(job_id: str, request: Request):
    job_svc = request.app.state.job_service
    job = job_svc.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/api/projects/{project_id}/sheets/{sheet_name}/review", response_model=ReviewReport)
async def get_review_report(project_id: str, sheet_name: str, request: Request):
    job_svc = request.app.state.job_service
    report = job_svc.get_review_report(project_id, sheet_name)
    if not report:
        raise HTTPException(404, "No review report found")
    return report


async def run_agent_job(app, job_id: str):
    """Background task: run ADK agent for a translation/review job."""
    job_svc = app.state.job_service
    job = job_svc.get_job(job_id)
    if not job:
        return

    job_svc.update_job(job_id, status=JobStatus.running, progress=10)

    try:
        runner = app.state.runner
        session_service = app.state.session_service

        if not runner or not session_service:
            raise RuntimeError("ADK Runner not initialized")

        # Create a new session for this job
        session = await session_service.create_session(
            app_name="game_translator",
            user_id=job.project_id,
        )

        # Build the user message based on job type
        if job.type.value == "translate_all":
            user_msg = f"Translate the {job.sheet_name} sheet for the {job.project_id} project. Translate all keys to all target languages."
        elif job.type.value == "update":
            user_msg = f"Update translations for the {job.sheet_name} sheet in the {job.project_id} project."
        elif job.type.value == "review":
            user_msg = f"Review the translations in the {job.sheet_name} sheet for the {job.project_id} project. Return a JSON report with issues."
        else:
            user_msg = f"Process the {job.sheet_name} sheet for the {job.project_id} project."

        from google.genai import types

        content = types.Content(
            role="user",
            parts=[types.Part(text=user_msg)],
        )

        job_svc.update_job(job_id, progress=30)

        # Run agent
        response_text = ""
        async for event in runner.run_async(
            session_id=session.id,
            user_id=job.project_id,
            new_message=content,
        ):
            if hasattr(event, "content") and event.content and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text

        job_svc.update_job(job_id, status=JobStatus.completed, progress=100, processed_keys=job.total_keys)

        # If review job, try to parse and store the report
        if job.type.value == "review" and response_text:
            import json
            try:
                report_data = json.loads(response_text)
                from backend.models import ReviewReport, ReviewIssue
                from datetime import datetime, timezone
                report = ReviewReport(
                    project_id=job.project_id,
                    sheet_name=job.sheet_name,
                    total_keys=report_data.get("total_keys", 0),
                    reviewed_keys=report_data.get("reviewed_keys", 0),
                    issues=[ReviewIssue(**i) for i in report_data.get("issues", [])],
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
                job_svc.store_review_report(job.project_id, job.sheet_name, report)
            except (json.JSONDecodeError, Exception):
                pass  # Agent response wasn't parseable JSON — ok for v0

    except Exception as e:
        job_svc.update_job(job_id, status=JobStatus.failed, error=str(e))
