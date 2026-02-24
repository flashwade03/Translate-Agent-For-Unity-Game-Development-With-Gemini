import csv

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.sheets_service import SheetsService
from backend.services.job_service import JobService


@pytest.fixture
def client(tmp_path):
    """TestClient with temp project directory."""
    project_dir = tmp_path / "projects" / "test_proj" / "sheets"
    project_dir.mkdir(parents=True)
    csv_path = project_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "English(en)", "Japanese(ja)"])
        writer.writerow(["btn_start", "Start", "スタート"])
        writer.writerow(["btn_stop", "Stop", "ストップ"])
        writer.writerow(["btn_exit", "Exit", "終了"])

    svc = SheetsService(projects_dir=tmp_path / "projects")
    job_svc = JobService()

    with TestClient(app) as c:
        # Override app state AFTER lifespan has run
        app.state.sheets_service = svc
        app.state.job_service = job_svc
        yield c


def test_delete_rows_endpoint(client):
    resp = client.request(
        "DELETE",
        "/api/projects/test_proj/sheets/UI/rows",
        json={"keys": ["btn_start", "btn_exit"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["deletedCount"] == 2


def test_delete_rows_blocked_by_active_job(client):
    # Create an active job on the same sheet
    job_svc: JobService = app.state.job_service
    job_svc.create_job("test_proj", "UI", "translate_all", 10)

    resp = client.request(
        "DELETE",
        "/api/projects/test_proj/sheets/UI/rows",
        json={"keys": ["btn_start"]},
    )
    assert resp.status_code == 409
