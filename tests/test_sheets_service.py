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


def test_add_row_success(svc):
    result = svc.add_row("test_proj", "UI", "new_key")
    assert result is True
    data = svc.get_sheet_data("test_proj", "UI")
    assert len(data.rows) == 4
    new_row = next(r for r in data.rows if r["key"] == "new_key")
    assert new_row["en"] == ""
    assert new_row["ja"] == ""


def test_add_row_duplicate_rejected(svc):
    result = svc.add_row("test_proj", "UI", "btn_start")
    assert result is False


def test_create_sheet_copies_headers(svc):
    result = svc.create_sheet("test_proj", "Items")
    assert result is True
    data = svc.get_sheet_data("test_proj", "Items")
    assert "English(en)" in data.headers
    assert "Japanese(ja)" in data.headers
    assert len(data.rows) == 0


def test_create_sheet_duplicate_rejected(svc):
    result = svc.create_sheet("test_proj", "UI")
    assert result is False


def test_delete_sheet_returns_key_count(svc):
    count = svc.delete_sheet("test_proj", "UI")
    assert count == 3
    csv_path = svc.projects_dir / "test_proj" / "sheets" / "UI.csv"
    assert not csv_path.exists()


def test_get_sheet_data_structure(svc):
    data = svc.get_sheet_data("test_proj", "UI")
    assert data.sheet_name == "UI"
    assert len(data.languages) == 2
    assert data.languages[0].code == "en"
    assert data.languages[0].is_source is True
    assert data.languages[1].code == "ja"
    assert len(data.rows) == 3


def test_update_cells(svc):
    svc.update_cells("test_proj", "UI", [{"key": "btn_start", "lang_code": "en", "value": "Begin"}])
    data = svc.get_sheet_data("test_proj", "UI")
    row = next(r for r in data.rows if r["key"] == "btn_start")
    assert row["en"] == "Begin"


# --- Hyphenated locale code tests ---


@pytest.fixture
def svc_hyphen(tmp_path):
    """SheetsService with hyphenated locale codes."""
    project_dir = tmp_path / "projects" / "test_proj" / "sheets"
    project_dir.mkdir(parents=True)
    csv_path = project_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Key", "English(en)", "Chinese (Simplified)(zh-Hans)", "Portuguese(pt-BR)"])
        writer.writerow(["btn_start", "Start", "开始", "Iniciar"])
    s = SheetsService(projects_dir=tmp_path / "projects")
    return s


def test_parse_hyphenated_locale_codes(svc_hyphen):
    data = svc_hyphen.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "zh-Hans" in codes
    assert "pt-BR" in codes


def test_update_cells_hyphenated_code(svc_hyphen):
    ok = svc_hyphen.update_cells("test_proj", "UI", [{"key": "btn_start", "lang_code": "zh-Hans", "value": "启动"}])
    assert ok is True
    data = svc_hyphen.get_sheet_data("test_proj", "UI")
    row = next(r for r in data.rows if r["key"] == "btn_start")
    assert row["zh-Hans"] == "启动"


def test_delete_language_hyphenated_code(svc_hyphen):
    deleted = svc_hyphen.delete_language("test_proj", "UI", "zh-Hans")
    assert deleted >= 0
    data = svc_hyphen.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "zh-Hans" not in codes
