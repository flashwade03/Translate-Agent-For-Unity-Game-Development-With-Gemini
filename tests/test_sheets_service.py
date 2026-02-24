import os
import csv
import pytest
from backend.services.sheets_service import SheetsService


@pytest.fixture
def svc(tmp_path):
    """Create a SheetsService with a temp project directory."""
    project_dir = tmp_path / "projects" / "test_proj" / "sheets"
    project_dir.mkdir(parents=True)
    csv_path = project_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["key", "English(en)", "Japanese(ja)"])
        writer.writerow(["btn_start", "Start", "スタート"])
        writer.writerow(["btn_stop", "Stop", "ストップ"])
        writer.writerow(["btn_exit", "Exit", "終了"])
    s = SheetsService(projects_dir=tmp_path / "projects")
    return s


def test_delete_rows_removes_matching_keys(svc):
    deleted = svc.delete_rows("test_proj", "UI", ["btn_start", "btn_exit"])
    assert deleted == 2
    data = svc.get_sheet_data("test_proj", "UI")
    assert len(data.rows) == 1
    assert data.rows[0]["key"] == "btn_stop"


def test_delete_rows_nonexistent_key_returns_partial_count(svc):
    deleted = svc.delete_rows("test_proj", "UI", ["btn_start", "no_such_key"])
    assert deleted == 1


def test_delete_rows_empty_list(svc):
    deleted = svc.delete_rows("test_proj", "UI", [])
    assert deleted == 0
    data = svc.get_sheet_data("test_proj", "UI")
    assert len(data.rows) == 3
