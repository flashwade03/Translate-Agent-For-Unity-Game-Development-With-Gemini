import uuid
from datetime import datetime, timezone
from backend.models import TranslationJob, JobStatus, JobType, ReviewReport


class JobService:
    def __init__(self):
        self._jobs: dict[str, TranslationJob] = {}
        self._review_reports: dict[str, ReviewReport] = {}

    def create_job(self, project_id: str, sheet_name: str, job_type: str) -> TranslationJob:
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        job = TranslationJob(
            job_id=job_id,
            project_id=project_id,
            sheet_name=sheet_name,
            type=JobType(job_type),
            status=JobStatus.pending,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> TranslationJob | None:
        return self._jobs.get(job_id)

    def update_job(self, job_id: str, **kwargs) -> None:
        job = self._jobs.get(job_id)
        if job:
            for k, v in kwargs.items():
                if hasattr(job, k):
                    setattr(job, k, v)

    def store_review_report(self, project_id: str, sheet_name: str, report: ReviewReport) -> None:
        key = f"{project_id}/{sheet_name}"
        self._review_reports[key] = report

    def get_review_report(self, project_id: str, sheet_name: str) -> ReviewReport | None:
        key = f"{project_id}/{sheet_name}"
        return self._review_reports.get(key)
