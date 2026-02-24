import csv
from unittest.mock import patch, MagicMock

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

    # Patch project_service.get_project so it returns a truthy value for test_proj
    fake_project = MagicMock()
    with patch("backend.routers.sheets.project_service") as mock_ps:
        mock_ps.get_project.return_value = fake_project
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


def test_list_sheets(client):
    resp = client.get("/api/projects/test_proj/sheets")
    assert resp.status_code == 200
    assert "UI" in resp.json()


def test_get_sheet_data(client):
    resp = client.get("/api/projects/test_proj/sheets/UI")
    assert resp.status_code == 200
    data = resp.json()
    assert data["sheetName"] == "UI"
    assert len(data["rows"]) == 3


def test_create_sheet_endpoint(client):
    resp = client.post("/api/projects/test_proj/sheets", json={"name": "Items"})
    assert resp.status_code == 201
    assert resp.json()["ok"] is True
    resp2 = client.get("/api/projects/test_proj/sheets")
    assert "Items" in resp2.json()


def test_create_sheet_duplicate_returns_409(client):
    resp = client.post("/api/projects/test_proj/sheets", json={"name": "UI"})
    assert resp.status_code == 409


def test_add_row_endpoint(client):
    resp = client.post("/api/projects/test_proj/sheets/UI/rows", json={"key": "new_key"})
    assert resp.status_code == 201
    assert resp.json()["ok"] is True


def test_add_row_duplicate_returns_409(client):
    resp = client.post("/api/projects/test_proj/sheets/UI/rows", json={"key": "btn_start"})
    assert resp.status_code == 409


def test_update_cells_endpoint(client):
    resp = client.put(
        "/api/projects/test_proj/sheets/UI/rows",
        json=[{"key": "btn_start", "langCode": "en", "value": "Begin"}],
    )
    assert resp.status_code == 200


def test_delete_sheet_endpoint(client):
    resp = client.delete("/api/projects/test_proj/sheets/UI")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["deletedKeys"] == 3
