from backend.services.job_service import JobService
from backend.models import JobStatus


def test_create_job():
    svc = JobService()
    job = svc.create_job("opal_app", "UI", "translate_all")
    assert job.status == JobStatus.pending
    assert job.project_id == "opal_app"
    assert job.sheet_name == "UI"


def test_get_job():
    svc = JobService()
    created = svc.create_job("opal_app", "UI", "review")
    fetched = svc.get_job(created.job_id)
    assert fetched is not None
    assert fetched.job_id == created.job_id


def test_get_job_not_found():
    svc = JobService()
    assert svc.get_job("nonexistent") is None


def test_update_job_status():
    svc = JobService()
    job = svc.create_job("opal_app", "UI", "translate_all")
    svc.update_job(job.job_id, status=JobStatus.running, progress=50, processed_keys=4)
    updated = svc.get_job(job.job_id)
    assert updated.status == JobStatus.running
    assert updated.progress == 50
