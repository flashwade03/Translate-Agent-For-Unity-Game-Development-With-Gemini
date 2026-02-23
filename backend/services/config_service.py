import uuid
import yaml
from pathlib import Path
from backend.models import (
    SheetSettings, Glossary, GlossaryEntry, GlossaryEntryCreate, StyleGuide,
)

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


class ConfigService:
    def __init__(self, projects_dir: Path = PROJECTS_DIR):
        self.projects_dir = projects_dir

    # --- Sheet Settings ---

    def get_sheet_settings(self, project_id: str, sheet_name: str) -> SheetSettings:
        path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.yaml"
        if not path.exists():
            return SheetSettings(project_id=project_id, sheet_name=sheet_name)
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return SheetSettings(
            project_id=project_id,
            sheet_name=sheet_name,
            source_language=data.get("source_language", "en"),
            translation_style=data.get("translation_style", "casual"),
            character_limit=data.get("character_limit"),
            glossary_override=data.get("glossary_override", False),
            instructions=data.get("instructions", ""),
        )

    def update_sheet_settings(self, project_id: str, sheet_name: str, settings: SheetSettings) -> SheetSettings:
        path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.yaml"
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "source_language": settings.source_language,
            "translation_style": settings.translation_style,
            "character_limit": settings.character_limit,
            "glossary_override": settings.glossary_override,
            "instructions": settings.instructions,
        }
        with open(path, "w") as f:
            yaml.dump(data, f)
        return settings

    # --- Glossary ---

    def get_glossary(self, project_id: str) -> Glossary:
        path = self.projects_dir / project_id / "glossary.yaml"
        if not path.exists():
            return Glossary(project_id=project_id, entries=[])
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        raw_entries = data.get("entries", [])
        needs_save = False
        entries = []
        for e in raw_entries:
            entry_id = e.get("id")
            if not entry_id:
                entry_id = str(uuid.uuid4())[:8]
                needs_save = True
            entries.append(
                GlossaryEntry(
                    id=entry_id,
                    source=e["source"],
                    target=e["target"],
                    language=e.get("language", ""),
                    context=e.get("context"),
                )
            )
        glossary = Glossary(project_id=project_id, entries=entries)
        if needs_save:
            self._save_glossary(project_id, glossary)
        return glossary

    def add_glossary_entry(self, project_id: str, entry: GlossaryEntryCreate) -> GlossaryEntry:
        glossary = self.get_glossary(project_id)
        new_entry = GlossaryEntry(id=str(uuid.uuid4())[:8], **entry.model_dump())
        glossary.entries.append(new_entry)
        self._save_glossary(project_id, glossary)
        return new_entry

    def update_glossary_entry(self, project_id: str, entry_id: str, updates: dict) -> GlossaryEntry | None:
        glossary = self.get_glossary(project_id)
        for e in glossary.entries:
            if e.id == entry_id:
                for k, v in updates.items():
                    if hasattr(e, k):
                        setattr(e, k, v)
                self._save_glossary(project_id, glossary)
                return e
        return None

    def delete_glossary_entry(self, project_id: str, entry_id: str) -> bool:
        glossary = self.get_glossary(project_id)
        original_len = len(glossary.entries)
        glossary.entries = [e for e in glossary.entries if e.id != entry_id]
        if len(glossary.entries) < original_len:
            self._save_glossary(project_id, glossary)
            return True
        return False

    def _save_glossary(self, project_id: str, glossary: Glossary) -> None:
        path = self.projects_dir / project_id / "glossary.yaml"
        data = {
            "entries": [
                {"id": e.id, "source": e.source, "target": e.target, "language": e.language, "context": e.context}
                for e in glossary.entries
            ]
        }
        with open(path, "w") as f:
            yaml.dump(data, f)

    # --- Style Guide ---

    def get_style_guide(self, project_id: str) -> StyleGuide:
        path = self.projects_dir / project_id / "style_guide.yaml"
        if not path.exists():
            return StyleGuide(project_id=project_id)
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return StyleGuide(
            project_id=project_id,
            tone=data.get("tone", ""),
            formality=data.get("formality", "neutral"),
            audience=data.get("audience", ""),
            rules=data.get("rules", ""),
            examples=data.get("examples", ""),
        )

    def update_style_guide(self, project_id: str, guide: StyleGuide) -> StyleGuide:
        path = self.projects_dir / project_id / "style_guide.yaml"
        data = {
            "tone": guide.tone,
            "formality": guide.formality,
            "audience": guide.audience,
            "rules": guide.rules,
            "examples": guide.examples,
        }
        with open(path, "w") as f:
            yaml.dump(data, f)
        return guide
