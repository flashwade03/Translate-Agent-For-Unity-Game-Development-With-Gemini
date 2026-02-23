import yaml
from pathlib import Path

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


def get_project_config(project_id: str) -> dict:
    """Load project configuration from YAML.

    Args:
        project_id: The project identifier (directory name under projects/).

    Returns:
        Dictionary with project configuration (default_source_language, etc.),
        or dict with 'error' key if project not found.
    """
    config_path = PROJECTS_DIR / project_id / "config.yaml"
    if not config_path.exists():
        return {"error": f"Project '{project_id}' not found at {config_path}"}
    with open(config_path) as f:
        return yaml.safe_load(f)


def get_sheet_context(project_id: str, sheet_name: str) -> dict:
    """Load sheet-specific context overrides from YAML.

    Args:
        project_id: The project identifier.
        sheet_name: The sheet name (used to find <sheet_name>.yaml).

    Returns:
        Dictionary with source_language, translation_style, character_limit,
        glossary_override, and instructions. Returns defaults if file missing.
    """
    defaults = {
        "source_language": "en",
        "translation_style": "casual",
        "character_limit": None,
        "glossary_override": False,
        "instructions": "",
    }
    sheet_path = PROJECTS_DIR / project_id / "sheets" / f"{sheet_name}.yaml"
    if not sheet_path.exists():
        return defaults
    with open(sheet_path) as f:
        data = yaml.safe_load(f) or {}
    return {**defaults, **data}
