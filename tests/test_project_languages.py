import pytest
from backend.services.config_service import ConfigService


@pytest.fixture
def svc(tmp_path):
    """ConfigService with a temp project directory."""
    proj_dir = tmp_path / "projects" / "test_proj"
    proj_dir.mkdir(parents=True)
    return ConfigService(projects_dir=tmp_path / "projects")


def test_get_project_languages_empty(svc):
    langs = svc.get_project_languages("test_proj")
    assert langs == []


def test_add_project_language(svc):
    lang = svc.add_project_language("test_proj", "en", "English")
    assert lang.code == "en"
    assert lang.label == "English"
    langs = svc.get_project_languages("test_proj")
    assert len(langs) == 1


def test_add_project_language_duplicate_rejected(svc):
    svc.add_project_language("test_proj", "en", "English")
    result = svc.add_project_language("test_proj", "en", "English")
    assert result is None


def test_delete_project_language(svc):
    svc.add_project_language("test_proj", "en", "English")
    svc.add_project_language("test_proj", "ja", "Japanese")
    result = svc.delete_project_language("test_proj", "en")
    assert result is True
    langs = svc.get_project_languages("test_proj")
    assert len(langs) == 1
    assert langs[0].code == "ja"


def test_delete_project_language_not_found(svc):
    result = svc.delete_project_language("test_proj", "xx")
    assert result is False


def test_add_multiple_languages(svc):
    svc.add_project_language("test_proj", "en", "English")
    svc.add_project_language("test_proj", "zh-Hans", "Chinese (Simplified)")
    svc.add_project_language("test_proj", "pt-BR", "Portuguese (Brazil)")
    langs = svc.get_project_languages("test_proj")
    assert len(langs) == 3
    codes = [l.code for l in langs]
    assert "zh-Hans" in codes
    assert "pt-BR" in codes
