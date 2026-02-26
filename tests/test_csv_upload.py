import csv
import pytest
import yaml
from backend.services.sheets_service import SheetsService
from backend.services.config_service import ConfigService


@pytest.fixture
def setup(tmp_path):
    """Create SheetsService + ConfigService with a temp project."""
    proj_dir = tmp_path / "projects" / "test_proj"
    sheets_dir = proj_dir / "sheets"
    sheets_dir.mkdir(parents=True)

    # Create config.yaml with initial languages
    config = {
        "name": "Test Project",
        "languages": [
            {"code": "en", "label": "English"},
            {"code": "ja", "label": "Japanese"},
        ],
    }
    with open(proj_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)

    # Create existing sheet
    csv_path = sheets_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Key", "English(en)", "Japanese(ja)"])
        writer.writerow(["btn_start", "Start", "スタート"])
        writer.writerow(["btn_stop", "Stop", "ストップ"])

    sheets_svc = SheetsService(projects_dir=tmp_path / "projects")
    config_svc = ConfigService(projects_dir=tmp_path / "projects")
    return sheets_svc, config_svc


def test_merge_overwrites_existing_keys(setup):
    sheets_svc, _ = setup
    upload = "Key,English(en),Japanese(ja)\nbtn_start,Begin,開始\n"
    result = sheets_svc.merge_csv("test_proj", "UI", upload)

    assert result.updated_keys == 1
    assert result.added_keys == 0

    data = sheets_svc.get_sheet_data("test_proj", "UI")
    row = next(r for r in data.rows if r["key"] == "btn_start")
    assert row["en"] == "Begin"
    assert row["ja"] == "開始"


def test_merge_adds_new_keys(setup):
    sheets_svc, _ = setup
    upload = "Key,English(en),Japanese(ja)\nbtn_exit,Exit,終了\n"
    result = sheets_svc.merge_csv("test_proj", "UI", upload)

    assert result.added_keys == 1
    assert result.updated_keys == 0

    data = sheets_svc.get_sheet_data("test_proj", "UI")
    assert len(data.rows) == 3
    row = next(r for r in data.rows if r["key"] == "btn_exit")
    assert row["en"] == "Exit"


def test_merge_mixed_add_and_update(setup):
    sheets_svc, _ = setup
    upload = "Key,English(en),Japanese(ja)\nbtn_start,Begin,開始\nbtn_new,New,新規\n"
    result = sheets_svc.merge_csv("test_proj", "UI", upload)

    assert result.updated_keys == 1
    assert result.added_keys == 1


def test_merge_rejects_missing_key_column(setup):
    sheets_svc, _ = setup
    upload = "Name,English(en)\nbtn_start,Start\n"
    with pytest.raises(ValueError, match="First column must be 'Key'"):
        sheets_svc.merge_csv("test_proj", "UI", upload)


def test_merge_rejects_invalid_header_format(setup):
    sheets_svc, _ = setup
    upload = "Key,English\nbtn_start,Start\n"
    with pytest.raises(ValueError, match="Invalid header format"):
        sheets_svc.merge_csv("test_proj", "UI", upload)


def test_merge_rejects_empty_csv(setup):
    sheets_svc, _ = setup
    with pytest.raises(ValueError, match="Empty CSV"):
        sheets_svc.merge_csv("test_proj", "UI", "")


def test_merge_auto_adds_new_language(setup):
    sheets_svc, config_svc = setup
    upload = "Key,English(en),Korean(ko)\nbtn_start,Start,시작\n"
    result = sheets_svc.merge_csv(
        "test_proj", "UI", upload, config_service=config_svc
    )

    assert len(result.added_languages) == 1
    assert result.added_languages[0].code == "ko"

    # Verify column was added to CSV
    data = sheets_svc.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "ko" in codes

    # Verify language was added to project config
    langs = config_svc.get_project_languages("test_proj")
    codes = [l.code for l in langs]
    assert "ko" in codes


def test_merge_auto_adds_language_to_other_sheets(setup):
    sheets_svc, config_svc = setup

    # Create another sheet
    sheets_svc.create_sheet("test_proj", "Items")

    upload = "Key,English(en),Korean(ko)\nbtn_start,Start,시작\n"
    sheets_svc.merge_csv(
        "test_proj", "UI", upload, config_service=config_svc
    )

    # Verify Korean column was also added to Items sheet
    items_data = sheets_svc.get_sheet_data("test_proj", "Items")
    codes = [l.code for l in items_data.languages]
    assert "ko" in codes


def test_merge_preserves_untouched_rows(setup):
    sheets_svc, _ = setup
    upload = "Key,English(en)\nbtn_start,Begin\n"
    sheets_svc.merge_csv("test_proj", "UI", upload)

    data = sheets_svc.get_sheet_data("test_proj", "UI")
    row = next(r for r in data.rows if r["key"] == "btn_stop")
    assert row["en"] == "Stop"
    assert row["ja"] == "ストップ"
