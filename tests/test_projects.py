import pytest
from backend.services.project_service import ProjectService


@pytest.fixture
def svc(tmp_path):
    return ProjectService(projects_dir=tmp_path)


def test_list_projects_empty(svc):
    assert svc.list_projects() == []


def test_create_project(svc):
    p = svc.create_project("Test Game", "A test project")
    assert p.name == "Test Game"
    assert p.id == "test_game"


def test_create_project_creates_yaml(svc, tmp_path):
    svc.create_project("My Game", "desc")
    config_path = tmp_path / "my_game" / "config.yaml"
    assert config_path.exists()


def test_list_projects_after_create(svc):
    svc.create_project("Game A", "desc a")
    svc.create_project("Game B", "desc b")
    projects = svc.list_projects()
    assert len(projects) == 2


def test_get_project(svc):
    svc.create_project("Found", "desc")
    p = svc.get_project("found")
    assert p is not None
    assert p.name == "Found"


def test_get_project_not_found(svc):
    assert svc.get_project("nonexistent") is None
