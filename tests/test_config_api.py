import pytest
import yaml
from pathlib import Path
from backend.services.config_service import ConfigService


@pytest.fixture
def svc(tmp_path):
    # Create project directory with default files
    proj = tmp_path / "opal_app"
    proj.mkdir()
    (proj / "sheets").mkdir()
    with open(proj / "glossary.yaml", "w") as f:
        yaml.dump({"entries": [
            {"source": "Level Up", "target": "レベルアップ", "language": "ja", "context": "Game"},
        ]}, f)
    with open(proj / "style_guide.yaml", "w") as f:
        yaml.dump({"tone": "Friendly", "formality": "casual", "audience": "Young adults", "rules": "", "examples": ""}, f)
    with open(proj / "sheets" / "UI.yaml", "w") as f:
        yaml.dump({"source_language": "en", "translation_style": "casual", "character_limit": 30, "glossary_override": False, "instructions": "Short text"}, f)
    return ConfigService(projects_dir=tmp_path)


def test_get_sheet_settings(svc):
    s = svc.get_sheet_settings("opal_app", "UI")
    assert s.source_language == "en"
    assert s.character_limit == 30


def test_get_sheet_settings_default(svc):
    s = svc.get_sheet_settings("opal_app", "NonExistent")
    assert s.source_language == "en"
    assert s.character_limit is None


def test_update_sheet_settings(svc):
    from backend.models import SheetSettings
    updated = SheetSettings(project_id="opal_app", sheet_name="UI", source_language="ja", translation_style="formal")
    result = svc.update_sheet_settings("opal_app", "UI", updated)
    assert result.source_language == "ja"
    # Verify persisted
    reloaded = svc.get_sheet_settings("opal_app", "UI")
    assert reloaded.source_language == "ja"


def test_get_glossary(svc):
    g = svc.get_glossary("opal_app")
    assert g.project_id == "opal_app"
    assert len(g.entries) == 1


def test_add_glossary_entry(svc):
    from backend.models import GlossaryEntryCreate
    entry = GlossaryEntryCreate(source="Score", target="スコア", language="ja", context="Points")
    created = svc.add_glossary_entry("opal_app", entry)
    assert created.source == "Score"
    assert created.id  # should have an ID
    g = svc.get_glossary("opal_app")
    assert len(g.entries) == 2


def test_update_glossary_entry(svc):
    g = svc.get_glossary("opal_app")
    entry_id = g.entries[0].id
    updated = svc.update_glossary_entry("opal_app", entry_id, {"target": "LevelUp!"})
    assert updated is not None
    assert updated.target == "LevelUp!"


def test_delete_glossary_entry(svc):
    g = svc.get_glossary("opal_app")
    entry_id = g.entries[0].id
    assert svc.delete_glossary_entry("opal_app", entry_id) is True
    g2 = svc.get_glossary("opal_app")
    assert len(g2.entries) == 0


def test_get_style_guide(svc):
    sg = svc.get_style_guide("opal_app")
    assert sg.tone == "Friendly"
    assert sg.formality == "casual"


def test_update_style_guide(svc):
    from backend.models import StyleGuide
    updated = StyleGuide(project_id="opal_app", tone="Serious", formality="formal", audience="Adults", rules="Be strict", examples="")
    result = svc.update_style_guide("opal_app", updated)
    assert result.tone == "Serious"
    reloaded = svc.get_style_guide("opal_app")
    assert reloaded.tone == "Serious"
