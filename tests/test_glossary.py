from game_translator.tools.glossary import get_glossary, get_style_guide


def test_get_glossary_returns_entries():
    result = get_glossary(project_id="opal_app")
    assert isinstance(result, dict)
    assert "entries" in result
    assert len(result["entries"]) > 0


def test_get_glossary_filter_by_language():
    result = get_glossary(project_id="opal_app", language="ja")
    assert all(e["language"] == "ja" for e in result["entries"])


def test_get_glossary_missing_project():
    result = get_glossary(project_id="nonexistent")
    assert "entries" in result
    assert len(result["entries"]) == 0


def test_get_style_guide_returns_dict():
    result = get_style_guide(project_id="opal_app")
    assert "tone" in result
    assert "formality" in result
    assert "rules" in result


def test_get_style_guide_missing_project():
    result = get_style_guide(project_id="nonexistent")
    assert "tone" in result
