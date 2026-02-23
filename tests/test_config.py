from game_translator.tools.config import get_project_config, get_sheet_context


def test_get_project_config_returns_dict():
    result = get_project_config(project_id="opal_app")
    assert isinstance(result, dict)
    assert "spreadsheet_id" in result
    assert "default_source_language" in result


def test_get_project_config_missing_project():
    result = get_project_config(project_id="nonexistent")
    assert "error" in result


def test_get_sheet_context_returns_dict():
    result = get_sheet_context(project_id="opal_app", sheet_name="UI")
    assert isinstance(result, dict)
    assert "source_language" in result


def test_get_sheet_context_missing_returns_defaults():
    result = get_sheet_context(project_id="opal_app", sheet_name="NonExistent")
    assert isinstance(result, dict)
    assert "source_language" in result
    assert result["character_limit"] is None
