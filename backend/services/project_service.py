import shutil
import yaml
from datetime import datetime, timezone
from pathlib import Path
from backend.models import Project, SourceType

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


class ProjectService:
    def __init__(self, projects_dir: Path = PROJECTS_DIR):
        self.projects_dir = projects_dir

    def list_projects(self) -> list[Project]:
        if not self.projects_dir.exists():
            return []
        projects = []
        for d in sorted(self.projects_dir.iterdir()):
            config_path = d / "config.yaml"
            if d.is_dir() and config_path.exists():
                p = self._load_project(d.name, config_path)
                if p:
                    projects.append(p)
        return projects

    def get_project(self, project_id: str) -> Project | None:
        config_path = self.projects_dir / project_id / "config.yaml"
        if not config_path.exists():
            return None
        return self._load_project(project_id, config_path)

    def create_project(
        self,
        name: str,
        description: str,
        source_type: str = "csv",
        spreadsheet_id: str | None = None,
    ) -> Project:
        project_id = name.lower().replace(" ", "_")
        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        # gws projects don't need a local sheets/ directory
        if source_type != "gws":
            (project_dir / "sheets").mkdir(exist_ok=True)

        now = datetime.now(timezone.utc).isoformat()
        config = {
            "name": name,
            "description": description,
            "default_source_language": "en",
            "source": source_type,
            "created_at": now,
            "last_translated_at": None,
        }
        if source_type == "gws" and spreadsheet_id:
            config["spreadsheet_id"] = spreadsheet_id

        with open(project_dir / "config.yaml", "w") as f:
            yaml.dump(config, f)

        # Create empty glossary and style guide
        with open(project_dir / "glossary.yaml", "w") as f:
            yaml.dump({"entries": []}, f)
        with open(project_dir / "style_guide.yaml", "w") as f:
            yaml.dump({"tone": "", "formality": "neutral", "audience": "", "rules": "", "examples": ""}, f)

        return Project(
            id=project_id,
            name=name,
            description=description,
            source_type=SourceType(source_type),
            spreadsheet_id=spreadsheet_id,
            sheet_count=0,
            last_translated_at=None,
            created_at=now,
        )

    def delete_project(self, project_id: str) -> bool:
        project_dir = self.projects_dir / project_id
        if not project_dir.exists():
            return False
        shutil.rmtree(project_dir)
        return True

    def _count_sheets(self, project_id: str) -> int:
        cfg_path = self.projects_dir / project_id / "config.yaml"
        if cfg_path.exists():
            with open(cfg_path) as f:
                cfg = yaml.safe_load(f) or {}
            if cfg.get("source") == "gws":
                return 0  # gws projects: tab count fetched at API call time
        sheets_dir = self.projects_dir / project_id / "sheets"
        if not sheets_dir.exists():
            return 0
        return len(list(sheets_dir.glob("*.csv")))

    def _load_project(self, project_id: str, config_path: Path) -> Project | None:
        with open(config_path) as f:
            data = yaml.safe_load(f) or {}
        source = data.get("source", "csv")
        return Project(
            id=project_id,
            name=data.get("name", project_id),
            description=data.get("description", ""),
            source_type=SourceType(source),
            spreadsheet_id=data.get("spreadsheet_id"),
            sheet_count=self._count_sheets(project_id),
            last_translated_at=data.get("last_translated_at"),
            created_at=data.get("created_at", ""),
        )
