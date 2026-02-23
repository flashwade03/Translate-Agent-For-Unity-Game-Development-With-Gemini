import yaml
from pathlib import Path

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


def get_glossary(project_id: str, language: str = "") -> dict:
    """Load project glossary from YAML, optionally filtered by language.

    Args:
        project_id: The project identifier.
        language: If provided, filter entries to this language code (e.g. 'ja').

    Returns:
        Dictionary with 'entries' list. Each entry has source, target, language, context.
        Returns empty entries list if glossary file not found.
    """
    glossary_path = PROJECTS_DIR / project_id / "glossary.yaml"
    if not glossary_path.exists():
        return {"entries": []}
    with open(glossary_path) as f:
        data = yaml.safe_load(f) or {}
    entries = data.get("entries", [])
    if language:
        entries = [e for e in entries if e.get("language") == language]
    return {"entries": entries}


def get_style_guide(project_id: str) -> dict:
    """Load project style guide from YAML.

    Args:
        project_id: The project identifier.

    Returns:
        Dictionary with tone, formality, audience, rules, examples.
        Returns defaults if file not found.
    """
    defaults = {
        "tone": "",
        "formality": "neutral",
        "audience": "",
        "rules": "",
        "examples": "",
    }
    guide_path = PROJECTS_DIR / project_id / "style_guide.yaml"
    if not guide_path.exists():
        return defaults
    with open(guide_path) as f:
        data = yaml.safe_load(f) or {}
    return {**defaults, **data}
