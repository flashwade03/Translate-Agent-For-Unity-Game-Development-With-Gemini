import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from backend.models import TranslationJob, JobCreatePayload, ReviewReport, JobStatus
from backend.routers.ws import broadcast_job_update

router = APIRouter(tags=["jobs"])
logger = logging.getLogger("agent_job")

WRITE_TOOL_NAMES = {"write_sheet", "save_pending_translations"}


@router.post("/api/projects/{project_id}/sheets/{sheet_name}/jobs", response_model=TranslationJob, status_code=201)
async def create_job(
    project_id: str,
    sheet_name: str,
    payload: JobCreatePayload,
    background_tasks: BackgroundTasks,
    request: Request,
):
    job_svc = request.app.state.job_service
    config_svc = request.app.state.config_service
    cfg = config_svc._read_config(project_id)
    source = cfg.get("source", "csv")

    total_keys = 0
    if source == "gws":
        spreadsheet_id = cfg.get("spreadsheet_id")
        if spreadsheet_id:
            try:
                gws_svc = request.app.state.gws_service
                sheet_data = await gws_svc.read_tab(spreadsheet_id, sheet_name)
                total_keys = len(sheet_data.rows)
            except Exception:
                pass  # Will be 0; agent will determine actual count
    else:
        sheets_svc = request.app.state.sheets_service
        sheet_data = sheets_svc.get_sheet_data(project_id, sheet_name)
        if sheet_data:
            total_keys = len(sheet_data.rows)

    job = job_svc.create_job(project_id, sheet_name, payload.type.value, total_keys=total_keys)

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


async def _run_agent_turn(runner, session_id, user_id, message):
    """Run one agent turn and return (response_text, called_write_tool, event_count)."""
    from google.genai import types

    content = types.Content(
        role="user",
        parts=[types.Part(text=message)],
    )

    response_text = ""
    called_write_tool = False
    event_count = 0

    async for event in runner.run_async(
        session_id=session_id,
        user_id=user_id,
        new_message=content,
    ):
        event_count += 1
        if getattr(event, "content", None) and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    if part.function_call.name in WRITE_TOOL_NAMES:
                        called_write_tool = True
                elif hasattr(part, "text") and part.text:
                    response_text += part.text

    return response_text, called_write_tool, event_count


async def run_agent_job(app, job_id: str):
    """Background task: run ADK agent for a translation/review job."""
    job_svc = app.state.job_service
    job = job_svc.get_job(job_id)
    if not job:
        return

    job_svc.update_job(job_id, status=JobStatus.running, progress=10)
    await broadcast_job_update(job_id, {
        "jobId": job_id,
        "status": JobStatus.running.value,
        "progress": 10,
        "processedKeys": 0,
        "totalKeys": job.total_keys,
        "error": None,
    })

    # Determine source type
    config_svc = app.state.config_service
    cfg = config_svc._read_config(job.project_id)
    source_type = cfg.get("source", "csv")

    try:
        session_service = app.state.session_service
        if not session_service:
            raise RuntimeError("ADK SessionService not initialized")

        # Create appropriate runner based on source type
        if source_type == "gws":
            from game_translator.agent import create_agent
            from google.adk.runners import Runner
            gws_agent = create_agent("gws")
            runner = Runner(
                agent=gws_agent,
                session_service=session_service,
                app_name="game_translator",
            )
        else:
            runner = app.state.runner
            if not runner:
                raise RuntimeError("ADK Runner not initialized")

        # Create a new session for this job
        session = await session_service.create_session(
            app_name="game_translator",
            user_id=job.project_id,
        )

        # Build the user message based on job type and source type
        if source_type == "gws":
            spreadsheet_id = cfg.get("spreadsheet_id", "")
            if job.type.value == "translate_all":
                user_msg = (
                    f"Translate the '{job.sheet_name}' tab in Google Sheets "
                    f"(spreadsheet ID: {spreadsheet_id}) for the '{job.project_id}' project. "
                    f"Translate all keys to all target languages. "
                    f"You MUST call save_pending_translations to save results."
                )
            elif job.type.value == "update":
                user_msg = (
                    f"Update translations for the '{job.sheet_name}' tab in Google Sheets "
                    f"(spreadsheet ID: {spreadsheet_id}) for the '{job.project_id}' project. "
                    f"You MUST call save_pending_translations to save results."
                )
            elif job.type.value == "review":
                user_msg = (
                    f"Review the translations in the '{job.sheet_name}' tab in Google Sheets "
                    f"(spreadsheet ID: {spreadsheet_id}) for the '{job.project_id}' project. "
                    f"Return a JSON report with issues."
                )
            else:
                user_msg = (
                    f"Process the '{job.sheet_name}' tab in Google Sheets "
                    f"(spreadsheet ID: {spreadsheet_id}) for the '{job.project_id}' project."
                )
        else:
            if job.type.value == "translate_all":
                user_msg = f"Translate the {job.sheet_name} sheet for the {job.project_id} project. Translate all keys to all target languages. You MUST call write_sheet to save results."
            elif job.type.value == "update":
                user_msg = f"Update translations for the {job.sheet_name} sheet in the {job.project_id} project. You MUST call write_sheet to save results."
            elif job.type.value == "review":
                user_msg = f"Review the translations in the {job.sheet_name} sheet for the {job.project_id} project. Return a JSON report with issues."
            else:
                user_msg = f"Process the {job.sheet_name} sheet for the {job.project_id} project."

        logger.info("Starting job %s: %s", job_id, user_msg)
        job_svc.update_job(job_id, progress=30)
        await broadcast_job_update(job_id, {
            "jobId": job_id,
            "status": JobStatus.running.value,
            "progress": 30,
            "processedKeys": 0,
            "totalKeys": job.total_keys,
            "error": None,
        })

        # Turn 1: Agent reads context, generates translations, and writes
        response_text, called_write_tool, events = await _run_agent_turn(
            runner, session.id, job.project_id, user_msg,
        )
        logger.info("Job %s turn1: events=%d called_write_tool=%s", job_id, events, called_write_tool)

        # Turn 2: If agent didn't call a write tool, nudge it
        if not called_write_tool and job.type.value in ("translate_all", "update"):
            logger.info("Job %s: write tool not called, sending follow-up", job_id)
            job_svc.update_job(job_id, progress=60)
            await broadcast_job_update(job_id, {
                "jobId": job_id,
                "status": JobStatus.running.value,
                "progress": 60,
                "processedKeys": 0,
                "totalKeys": job.total_keys,
                "error": None,
            })

            if source_type == "gws":
                followup = (
                    "You have the translations ready. Now call "
                    "save_pending_translations(project_id, sheet_name, translations) "
                    "to save them for user review. Each translation needs 'key', 'lang_code', 'value'."
                )
            else:
                followup = (
                    "You have the translations ready. Now call "
                    "write_sheet(project_id, sheet_name, updates) to save them to the CSV file. "
                    "Each update needs 'key', 'lang_code', and 'value'."
                )
            response_text2, called_write_tool2, events2 = await _run_agent_turn(
                runner, session.id, job.project_id, followup,
            )
            logger.info("Job %s turn2: events=%d called_write_tool=%s", job_id, events2, called_write_tool2)
            response_text += response_text2

        job_svc.update_job(job_id, status=JobStatus.completed, progress=100, processed_keys=job.total_keys)
        await broadcast_job_update(job_id, {
            "jobId": job_id,
            "status": JobStatus.completed.value,
            "progress": 100,
            "processedKeys": job.total_keys,
            "totalKeys": job.total_keys,
            "error": None,
        })

        # Persist to job history
        history_svc = app.state.job_history_service
        if history_svc:
            job = job_svc.get_job(job_id)
            if job:
                await history_svc.save_job(job)

        # If review job, try to parse and store the report
        if job.type.value == "review" and response_text:
            import json
            import re
            try:
                # Extract JSON from markdown fences if present
                json_str = response_text
                fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", json_str, re.DOTALL)
                if fence_match:
                    json_str = fence_match.group(1).strip()

                report_data = json.loads(json_str)
                from backend.models import ReviewReport, ReviewIssue
                from datetime import datetime, timezone
                import uuid

                issues = []
                for i, raw in enumerate(report_data.get("issues", [])):
                    if "id" not in raw:
                        raw["id"] = f"issue_{uuid.uuid4().hex[:8]}"
                    issues.append(ReviewIssue(**raw))

                report = ReviewReport(
                    project_id=job.project_id,
                    sheet_name=job.sheet_name,
                    total_keys=report_data.get("total_keys", job.total_keys),
                    reviewed_keys=report_data.get("reviewed_keys", job.total_keys),
                    issues=issues,
                    created_at=datetime.now(timezone.utc).isoformat(),
                )
                job_svc.store_review_report(job.project_id, job.sheet_name, report)
                logger.info("Job %s: stored review report with %d issues", job_id, len(issues))
            except Exception as e:
                logger.warning("Job %s: failed to parse review response: %s", job_id, e)
                logger.debug("Job %s: response_text=%s", job_id, response_text[:500])

    except Exception as e:
        logger.exception("Job %s failed", job_id)
        job_svc.update_job(job_id, status=JobStatus.failed, error=str(e))
        job = job_svc.get_job(job_id)
        await broadcast_job_update(job_id, {
            "jobId": job_id,
            "status": JobStatus.failed.value,
            "progress": job.progress if job else 0,
            "processedKeys": job.processed_keys if job else 0,
            "totalKeys": job.total_keys if job else 0,
            "error": str(e),
        })

        # Persist to job history
        history_svc = app.state.job_history_service
        if history_svc:
            job = job_svc.get_job(job_id)
            if job:
                await history_svc.save_job(job)
