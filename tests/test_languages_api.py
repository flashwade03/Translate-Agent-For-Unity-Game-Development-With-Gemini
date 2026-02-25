import csv
import yaml
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.config_service import ConfigService
from backend.services.sheets_service import SheetsService


@pytest.fixture
def client(tmp_path):
    proj_dir = tmp_path / "projects" / "test_proj"
    proj_dir.mkdir(parents=True)

    config_svc = ConfigService(projects_dir=tmp_path / "projects")
    sheets_svc = SheetsService(projects_dir=tmp_path / "projects")

    fake_project = MagicMock()
    with patch("backend.routers.languages.project_service") as mock_ps:
        mock_ps.get_project.return_value = fake_project
        with TestClient(app) as c:
            app.state.config_service = config_svc
            app.state.sheets_service = sheets_svc
            yield c


def test_list_project_languages_empty(client):
    resp = client.get("/api/projects/test_proj/languages")
    assert resp.status_code == 200
    assert resp.json() == []


def test_add_project_language(client):
    resp = client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "en"
    assert data["label"] == "English"


def test_add_project_language_duplicate_409(client):
    client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    resp = client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    assert resp.status_code == 409


def test_delete_project_language(client):
    client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    resp = client.delete("/api/projects/test_proj/languages/en")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


def test_delete_language_not_found_404(client):
    resp = client.delete("/api/projects/test_proj/languages/xx")
    assert resp.status_code == 404


@pytest.fixture
def client_with_sheets(tmp_path):
    """Client with sheets that have language columns."""
    proj_dir = tmp_path / "projects" / "test_proj"
    sheets_dir = proj_dir / "sheets"
    sheets_dir.mkdir(parents=True)

    # Create config with languages
    cfg = {"languages": [{"code": "en", "label": "English"}, {"code": "ja", "label": "Japanese"}]}
    with open(proj_dir / "config.yaml", "w") as f:
        yaml.dump(cfg, f)

    # Create a sheet CSV
    csv_path = sheets_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Key", "English(en)", "Japanese(ja)"])
        writer.writerow(["btn_start", "Start", "スタート"])

    config_svc = ConfigService(projects_dir=tmp_path / "projects")
    sheets_svc = SheetsService(projects_dir=tmp_path / "projects")

    fake_project = MagicMock()
    with patch("backend.routers.languages.project_service") as mock_ps:
        mock_ps.get_project.return_value = fake_project
        with TestClient(app) as c:
            app.state.config_service = config_svc
            app.state.sheets_service = sheets_svc
            yield c, sheets_svc


def test_delete_language_syncs_csv_columns(client_with_sheets):
    client, sheets_svc = client_with_sheets
    resp = client.delete("/api/projects/test_proj/languages/ja")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["affectedSheets"] == 1
    assert body["affectedTranslations"] == 1

    # Verify CSV column was removed
    data = sheets_svc.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "ja" not in codes


def test_create_sheet_uses_project_languages(tmp_path):
    """When project has languages in config, new sheet uses those for headers."""
    proj_dir = tmp_path / "projects" / "test_proj"
    sheets_dir = proj_dir / "sheets"
    sheets_dir.mkdir(parents=True)

    config = {"languages": [{"code": "en", "label": "English"}, {"code": "zh-Hans", "label": "Chinese (Simplified)"}]}
    with open(proj_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)

    svc = SheetsService(projects_dir=tmp_path / "projects")
    svc.create_sheet("test_proj", "NewSheet")
    data = svc.get_sheet_data("test_proj", "NewSheet")
    assert data.headers == ["Key", "English(en)", "Chinese (Simplified)(zh-Hans)"]
    assert len(data.languages) == 2
