import pytest
import yaml
from pathlib import Path
from backend.services.config_service import ConfigService


@pytest.fixture
def svc(tmp_path):
    # Create project directory with config.yaml containing defaults + sheet overrides
    proj = tmp_path / "opal_app"
    proj.mkdir()
    (proj / "sheets").mkdir()
    with open(proj / "config.yaml", "w") as f:
        yaml.dump({
            "name": "Opal App",
            "defaults": {
                "source_language": "en",
                "translation_style": "",
                "character_limit": None,
                "glossary_override": "",
                "instructions": "",
            },
            "sheet_settings": {
                "UI": {
                    "translation_style": "formal",
                    "character_limit": 30,
                },
            },
        }, f)
    with open(proj / "glossary.yaml", "w") as f:
        yaml.dump({"entries": [
            {"source": "Level Up", "target": "レベルアップ", "language": "ja", "context": "Game"},
        ]}, f)
    with open(proj / "style_guide.yaml", "w") as f:
        yaml.dump({"tone": "Friendly", "formality": "casual", "audience": "Young adults", "rules": "", "examples": ""}, f)
    return ConfigService(projects_dir=tmp_path)


# --- Sheet Settings (config.yaml based) ---


def test_get_sheet_settings_returns_overrides(svc):
    resp = svc.get_sheet_settings("opal_app", "UI")
    assert resp.project_id == "opal_app"
    assert resp.sheet_name == "UI"
    assert resp.settings.translation_style == "formal"
    assert resp.settings.character_limit == 30
    # Non-overridden fields are None
    assert resp.settings.source_language is None


def test_get_sheet_settings_no_overrides(svc):
    resp = svc.get_sheet_settings("opal_app", "NonExistent")
    assert resp.settings.source_language is None
    assert resp.settings.translation_style is None
    assert resp.settings.character_limit is None


def test_get_sheet_settings_includes_project_defaults(svc):
    resp = svc.get_sheet_settings("opal_app", "UI")
    assert resp.project_defaults.source_language == "en"
    assert resp.project_defaults.translation_style == ""


def test_project_defaults_fallback_to_hardcoded(svc, tmp_path):
    # Project with no config.yaml
    (tmp_path / "empty_proj").mkdir()
    resp = svc.get_sheet_settings("empty_proj", "SomeSheet")
    assert resp.project_defaults.source_language == "en"
    assert resp.project_defaults.glossary_override == ""


def test_update_sheet_settings_saves_overrides(svc):
    from backend.models import SheetSettings
    settings = SheetSettings(source_language="ja", translation_style="formal")
    result = svc.update_sheet_settings("opal_app", "UI", settings)
    assert result.settings.source_language == "ja"
    assert result.settings.translation_style == "formal"
    # Verify persisted
    reloaded = svc.get_sheet_settings("opal_app", "UI")
    assert reloaded.settings.source_language == "ja"


def test_update_sheet_settings_removes_null_overrides(svc):
    from backend.models import SheetSettings
    # Send all-null = remove all overrides
    settings = SheetSettings()
    svc.update_sheet_settings("opal_app", "UI", settings)
    reloaded = svc.get_sheet_settings("opal_app", "UI")
    # UI section should be gone
    assert reloaded.settings.translation_style is None
    assert reloaded.settings.character_limit is None


def test_glossary_override_is_string(svc):
    from backend.models import SheetSettings
    settings = SheetSettings(glossary_override="sword → 剣\nshield → 盾")
    result = svc.update_sheet_settings("opal_app", "Items", settings)
    assert result.settings.glossary_override == "sword → 剣\nshield → 盾"


# --- Glossary ---


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


# --- Style Guide ---


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
