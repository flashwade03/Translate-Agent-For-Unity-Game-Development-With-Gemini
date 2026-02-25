import uuid
import yaml
from pathlib import Path
from backend.models import (
    SheetSettings, SheetSettingsResponse,
    Glossary, GlossaryEntry, GlossaryEntryCreate, StyleGuide,
    ProjectLanguage,
)

_HARDCODED_DEFAULTS = SheetSettings(
    source_language="en",
    translation_style="",
    character_limit=None,
    glossary_override="",
    instructions="",
)

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


class ConfigService:
    def __init__(self, projects_dir: Path = PROJECTS_DIR):
        self.projects_dir = projects_dir

    # --- helpers for config.yaml ---

    def _read_config(self, project_id: str) -> dict:
        path = self.projects_dir / project_id / "config.yaml"
        if not path.exists():
            return {}
        with open(path) as f:
            return yaml.safe_load(f) or {}

    def _write_config(self, project_id: str, data: dict) -> None:
        path = self.projects_dir / project_id / "config.yaml"
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w") as f:
            yaml.dump(data, f)

    # --- Project Languages ---

    def get_project_languages(self, project_id: str) -> list[ProjectLanguage]:
        cfg = self._read_config(project_id)
        raw = cfg.get("languages") or []
        return [ProjectLanguage(code=l["code"], label=l["label"]) for l in raw]

    def add_project_language(self, project_id: str, code: str, label: str) -> ProjectLanguage | None:
        cfg = self._read_config(project_id)
        langs = cfg.get("languages") or []
        if any(l["code"] == code for l in langs):
            return None
        langs.append({"code": code, "label": label})
        cfg["languages"] = langs
        self._write_config(project_id, cfg)
        return ProjectLanguage(code=code, label=label)

    def delete_project_language(self, project_id: str, code: str) -> bool:
        cfg = self._read_config(project_id)
        langs = cfg.get("languages") or []
        new_langs = [l for l in langs if l["code"] != code]
        if len(new_langs) == len(langs):
            return False
        cfg["languages"] = new_langs
        self._write_config(project_id, cfg)
        return True

    # --- Sheet Settings ---

    def get_project_defaults(self, project_id: str) -> SheetSettings:
        cfg = self._read_config(project_id)
        defaults_raw = cfg.get("defaults") or {}
        return SheetSettings(
            source_language=defaults_raw.get("source_language", _HARDCODED_DEFAULTS.source_language),
            translation_style=defaults_raw.get("translation_style", _HARDCODED_DEFAULTS.translation_style),
            character_limit=defaults_raw.get("character_limit", _HARDCODED_DEFAULTS.character_limit),
            glossary_override=defaults_raw.get("glossary_override", _HARDCODED_DEFAULTS.glossary_override),
            instructions=defaults_raw.get("instructions", _HARDCODED_DEFAULTS.instructions),
        )

    def get_sheet_settings(self, project_id: str, sheet_name: str) -> SheetSettingsResponse:
        cfg = self._read_config(project_id)
        sheet_raw = (cfg.get("sheet_settings") or {}).get(sheet_name) or {}
        overrides = SheetSettings(**{k: v for k, v in sheet_raw.items() if k in SheetSettings.model_fields})
        return SheetSettingsResponse(
            project_id=project_id,
            sheet_name=sheet_name,
            settings=overrides,
            project_defaults=self.get_project_defaults(project_id),
        )

    def update_sheet_settings(self, project_id: str, sheet_name: str, settings: SheetSettings) -> SheetSettingsResponse:
        cfg = self._read_config(project_id)
        sheet_settings_all = cfg.get("sheet_settings") or {}
        overrides = {k: v for k, v in settings.model_dump().items() if v is not None and v != ""}
        if overrides:
            sheet_settings_all[sheet_name] = overrides
        else:
            sheet_settings_all.pop(sheet_name, None)
        cfg["sheet_settings"] = sheet_settings_all
        self._write_config(project_id, cfg)
        return self.get_sheet_settings(project_id, sheet_name)

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
