# Backend (FastAPI) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** FastAPI 서버로 프론트엔드 mock API 16개 엔드포인트를 실제 구현. ADK Runner + MCP Google Sheets 연동.

**Architecture:** FastAPI가 메인 서버. 4개 라우터(projects, sheets, config, jobs)가 3개 서비스(project_service, sheets_service, job_service)를 호출. Sheets는 MCP 클라이언트, 에이전트 실행은 ADK Runner, 설정은 YAML 파일 시스템.

**Tech Stack:** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, Google ADK Runner, MCP client, PyYAML, aiosqlite

---

### Task 1: FastAPI Scaffolding + Dependencies

**Files:**
- Modify: `pyproject.toml`
- Create: `backend/__init__.py`
- Create: `backend/main.py`

**Step 1: Update pyproject.toml**

```toml
[project]
name = "game-translator"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "google-adk>=1.0.0",
    "mcp",
    "pyyaml>=6.0",
    "python-dotenv>=1.0",
    "fastapi>=0.115",
    "uvicorn[standard]>=0.34",
    "aiosqlite>=0.20",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "httpx>=0.28",
]

[tool.setuptools.packages.find]
include = ["game_translator*", "backend*"]
```

**Step 2: Create backend package**

`backend/__init__.py`: (empty)

`backend/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Game Translator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

**Step 3: Install and verify**

Run: `pip install -e ".[dev]"`
Run: `uvicorn backend.main:app --port 8000 &`
Run: `curl http://localhost:8000/api/health`
Expected: `{"status":"ok"}`

Kill the server after verification.

---

### Task 2: Pydantic Models

**Files:**
- Create: `backend/models.py`

**Step 1: Create all Pydantic models matching frontend TypeScript types**

`backend/models.py`:
```python
from __future__ import annotations
from datetime import datetime
from enum import Enum
from pydantic import BaseModel


# --- Projects ---

class Project(BaseModel):
    id: str
    name: str
    description: str
    spreadsheetId: str
    sheetCount: int = 0
    lastTranslatedAt: str | None = None
    createdAt: str


class CreateProjectPayload(BaseModel):
    name: str
    description: str
    spreadsheetId: str


# --- Sheets ---

class Language(BaseModel):
    code: str
    label: str
    isSource: bool


class SheetData(BaseModel):
    sheetName: str
    headers: list[str]
    languages: list[Language]
    rows: list[dict]


class RowUpdate(BaseModel):
    key: str
    langCode: str
    value: str


# --- Sheet Settings ---

class SheetSettings(BaseModel):
    projectId: str
    sheetName: str
    sourceLanguage: str = "en"
    translationStyle: str = "casual"
    characterLimit: int | None = None
    glossaryOverride: bool = False
    instructions: str = ""


# --- Glossary ---

class GlossaryEntry(BaseModel):
    id: str
    source: str
    target: str
    context: str | None = None
    language: str


class GlossaryEntryCreate(BaseModel):
    source: str
    target: str
    context: str | None = None
    language: str


class Glossary(BaseModel):
    projectId: str
    entries: list[GlossaryEntry]


# --- Style Guide ---

class StyleGuide(BaseModel):
    projectId: str
    tone: str = ""
    formality: str = "neutral"
    audience: str = ""
    rules: str = ""
    examples: str = ""


# --- Jobs ---

class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobType(str, Enum):
    translate_all = "translate_all"
    update = "update"
    review = "review"


class TranslationJob(BaseModel):
    jobId: str
    projectId: str
    sheetName: str
    type: JobType
    status: JobStatus = JobStatus.pending
    progress: int = 0
    totalKeys: int = 0
    processedKeys: int = 0
    error: str | None = None
    createdAt: str


class JobCreatePayload(BaseModel):
    type: JobType


# --- Review ---

class IssueSeverity(str, Enum):
    error = "error"
    warning = "warning"
    info = "info"


class IssueCategory(str, Enum):
    accuracy = "accuracy"
    fluency = "fluency"
    terminology = "terminology"
    style = "style"
    placeholder = "placeholder"
    length = "length"


class ReviewIssue(BaseModel):
    id: str
    key: str
    language: str
    severity: IssueSeverity
    category: IssueCategory
    message: str
    suggestion: str | None = None
    original: str
    translated: str


class ReviewReport(BaseModel):
    projectId: str
    sheetName: str
    totalKeys: int
    reviewedKeys: int
    issues: list[ReviewIssue]
    createdAt: str
```

**Step 2: Verify import**

Run: `python -c "from backend.models import Project, TranslationJob, ReviewReport; print('Models OK')"`
Expected: `Models OK`

---

### Task 3: Project Service + Router + Tests

**Files:**
- Create: `backend/services/__init__.py`
- Create: `backend/services/project_service.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/routers/projects.py`
- Create: `tests/test_projects.py`

**Step 1: Write tests**

`tests/test_projects.py`:
```python
import pytest
from pathlib import Path
from backend.services.project_service import ProjectService


@pytest.fixture
def svc(tmp_path):
    return ProjectService(projects_dir=tmp_path)


def test_list_projects_empty(svc):
    assert svc.list_projects() == []


def test_create_project(svc):
    p = svc.create_project("Test Game", "A test project", "sheet123")
    assert p.name == "Test Game"
    assert p.spreadsheetId == "sheet123"
    assert p.id == "test_game"


def test_create_project_creates_yaml(svc, tmp_path):
    svc.create_project("My Game", "desc", "sid")
    config_path = tmp_path / "my_game" / "config.yaml"
    assert config_path.exists()


def test_list_projects_after_create(svc):
    svc.create_project("Game A", "desc a", "sid_a")
    svc.create_project("Game B", "desc b", "sid_b")
    projects = svc.list_projects()
    assert len(projects) == 2


def test_get_project(svc):
    svc.create_project("Found", "desc", "sid")
    p = svc.get_project("found")
    assert p is not None
    assert p.name == "Found"


def test_get_project_not_found(svc):
    assert svc.get_project("nonexistent") is None
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_projects.py -v`
Expected: FAIL (module not found)

**Step 3: Implement project service**

`backend/services/__init__.py`: (empty)

`backend/services/project_service.py`:
```python
import yaml
from datetime import datetime, timezone
from pathlib import Path
from backend.models import Project, CreateProjectPayload

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

    def create_project(self, name: str, description: str, spreadsheet_id: str) -> Project:
        project_id = name.lower().replace(" ", "_")
        project_dir = self.projects_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        (project_dir / "sheets").mkdir(exist_ok=True)

        now = datetime.now(timezone.utc).isoformat()
        config = {
            "name": name,
            "description": description,
            "spreadsheet_id": spreadsheet_id,
            "default_source_language": "en",
            "created_at": now,
            "sheet_count": 0,
            "last_translated_at": None,
        }
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
            spreadsheetId=spreadsheet_id,
            sheetCount=0,
            lastTranslatedAt=None,
            createdAt=now,
        )

    def _load_project(self, project_id: str, config_path: Path) -> Project | None:
        with open(config_path) as f:
            data = yaml.safe_load(f) or {}
        return Project(
            id=project_id,
            name=data.get("name", project_id),
            description=data.get("description", ""),
            spreadsheetId=data.get("spreadsheet_id", ""),
            sheetCount=data.get("sheet_count", 0),
            lastTranslatedAt=data.get("last_translated_at"),
            createdAt=data.get("created_at", ""),
        )
```

**Step 4: Run tests**

Run: `pytest tests/test_projects.py -v`
Expected: All 6 tests PASS

**Step 5: Implement router**

`backend/routers/__init__.py`: (empty)

`backend/routers/projects.py`:
```python
from fastapi import APIRouter, HTTPException
from backend.models import Project, CreateProjectPayload
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects", tags=["projects"])
service = ProjectService()


@router.get("", response_model=list[Project])
async def list_projects():
    return service.list_projects()


@router.get("/{project_id}", response_model=Project)
async def get_project(project_id: str):
    p = service.get_project(project_id)
    if not p:
        raise HTTPException(404, f"Project '{project_id}' not found")
    return p


@router.post("", response_model=Project, status_code=201)
async def create_project(payload: CreateProjectPayload):
    return service.create_project(payload.name, payload.description, payload.spreadsheetId)
```

**Step 6: Wire router into main.py**

Add to `backend/main.py`:
```python
from backend.routers import projects

app.include_router(projects.router)
```

---

### Task 4: Config Router (Sheet Settings + Glossary + Style Guide) + Tests

**Files:**
- Create: `backend/services/config_service.py`
- Create: `backend/routers/config.py`
- Create: `tests/test_config_api.py`

**Step 1: Write tests**

`tests/test_config_api.py`:
```python
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
    assert s.sourceLanguage == "en"
    assert s.characterLimit == 30


def test_get_sheet_settings_default(svc):
    s = svc.get_sheet_settings("opal_app", "NonExistent")
    assert s.sourceLanguage == "en"
    assert s.characterLimit is None


def test_update_sheet_settings(svc):
    from backend.models import SheetSettings
    updated = SheetSettings(projectId="opal_app", sheetName="UI", sourceLanguage="ja", translationStyle="formal")
    result = svc.update_sheet_settings("opal_app", "UI", updated)
    assert result.sourceLanguage == "ja"
    # Verify persisted
    reloaded = svc.get_sheet_settings("opal_app", "UI")
    assert reloaded.sourceLanguage == "ja"


def test_get_glossary(svc):
    g = svc.get_glossary("opal_app")
    assert g.projectId == "opal_app"
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
    updated = StyleGuide(projectId="opal_app", tone="Serious", formality="formal", audience="Adults", rules="Be strict", examples="")
    result = svc.update_style_guide("opal_app", updated)
    assert result.tone == "Serious"
    reloaded = svc.get_style_guide("opal_app")
    assert reloaded.tone == "Serious"
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_config_api.py -v`
Expected: FAIL

**Step 3: Implement config service**

`backend/services/config_service.py`:
```python
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
        defaults = SheetSettings(projectId=project_id, sheetName=sheet_name)
        if not path.exists():
            return defaults
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return SheetSettings(
            projectId=project_id,
            sheetName=sheet_name,
            sourceLanguage=data.get("source_language", "en"),
            translationStyle=data.get("translation_style", "casual"),
            characterLimit=data.get("character_limit"),
            glossaryOverride=data.get("glossary_override", False),
            instructions=data.get("instructions", ""),
        )

    def update_sheet_settings(self, project_id: str, sheet_name: str, settings: SheetSettings) -> SheetSettings:
        path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.yaml"
        path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "source_language": settings.sourceLanguage,
            "translation_style": settings.translationStyle,
            "character_limit": settings.characterLimit,
            "glossary_override": settings.glossaryOverride,
            "instructions": settings.instructions,
        }
        with open(path, "w") as f:
            yaml.dump(data, f)
        return settings

    # --- Glossary ---

    def get_glossary(self, project_id: str) -> Glossary:
        path = self.projects_dir / project_id / "glossary.yaml"
        if not path.exists():
            return Glossary(projectId=project_id, entries=[])
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        raw_entries = data.get("entries", [])
        entries = [
            GlossaryEntry(
                id=e.get("id", str(uuid.uuid4())[:8]),
                source=e["source"],
                target=e["target"],
                language=e.get("language", ""),
                context=e.get("context"),
            )
            for e in raw_entries
        ]
        return Glossary(projectId=project_id, entries=entries)

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
            return StyleGuide(projectId=project_id)
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        return StyleGuide(
            projectId=project_id,
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
```

**Step 4: Run tests**

Run: `pytest tests/test_config_api.py -v`
Expected: All 10 tests PASS

**Step 5: Implement config router**

`backend/routers/config.py`:
```python
from fastapi import APIRouter, HTTPException
from backend.models import (
    SheetSettings, Glossary, GlossaryEntry, GlossaryEntryCreate, StyleGuide,
)
from backend.services.config_service import ConfigService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["config"])
service = ConfigService()


# --- Sheet Settings ---

@router.get("/sheets/{sheet_name}/settings", response_model=SheetSettings)
async def get_sheet_settings(project_id: str, sheet_name: str):
    return service.get_sheet_settings(project_id, sheet_name)


@router.put("/sheets/{sheet_name}/settings", response_model=SheetSettings)
async def update_sheet_settings(project_id: str, sheet_name: str, settings: SheetSettings):
    return service.update_sheet_settings(project_id, sheet_name, settings)


# --- Glossary ---

@router.get("/glossary", response_model=Glossary)
async def get_glossary(project_id: str):
    return service.get_glossary(project_id)


@router.post("/glossary", response_model=GlossaryEntry, status_code=201)
async def add_glossary_entry(project_id: str, entry: GlossaryEntryCreate):
    return service.add_glossary_entry(project_id, entry)


@router.put("/glossary/{entry_id}", response_model=GlossaryEntry)
async def update_glossary_entry(project_id: str, entry_id: str, updates: dict):
    result = service.update_glossary_entry(project_id, entry_id, updates)
    if not result:
        raise HTTPException(404, "Entry not found")
    return result


@router.delete("/glossary/{entry_id}")
async def delete_glossary_entry(project_id: str, entry_id: str):
    if not service.delete_glossary_entry(project_id, entry_id):
        raise HTTPException(404, "Entry not found")
    return {"ok": True}


# --- Style Guide ---

@router.get("/style-guide", response_model=StyleGuide)
async def get_style_guide(project_id: str):
    return service.get_style_guide(project_id)


@router.put("/style-guide", response_model=StyleGuide)
async def update_style_guide(project_id: str, guide: StyleGuide):
    return service.update_style_guide(project_id, guide)
```

**Step 6: Wire router into main.py**

Add to `backend/main.py`:
```python
from backend.routers import config

app.include_router(config.router)
```

---

### Task 5: Sheets Service (MCP Client) + Router

**Files:**
- Create: `backend/services/sheets_service.py`
- Create: `backend/routers/sheets.py`

Note: Sheets service는 외부 MCP 서버 의존이므로 unit test가 아닌 integration test. MCP 서버 없이는 동작하지 않음.

**Step 1: Implement sheets service**

`backend/services/sheets_service.py`:
```python
import os
import re
from contextlib import asynccontextmanager
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from backend.models import SheetData, Language


class SheetsService:
    def __init__(self):
        self._session: ClientSession | None = None
        self._read = None
        self._write = None
        self.service_account_path = os.environ.get(
            "SERVICE_ACCOUNT_PATH",
            os.path.join(os.path.dirname(__file__), "..", "..", "config", "service-account.json"),
        )

    async def connect(self):
        """Start MCP server and create client session."""
        server_params = StdioServerParameters(
            command="uvx",
            args=["mcp-google-sheets"],
            env={**os.environ, "SERVICE_ACCOUNT_PATH": self.service_account_path},
        )
        self._read, self._write = await stdio_client(server_params).__aenter__()
        self._session = ClientSession(self._read, self._write)
        await self._session.initialize()

    async def disconnect(self):
        """Close MCP session."""
        if self._session:
            # MCP client cleanup handled by context manager
            self._session = None

    async def _call_tool(self, name: str, arguments: dict) -> dict:
        if not self._session:
            raise RuntimeError("SheetsService not connected")
        result = await self._session.call_tool(name, arguments)
        # MCP tool results come as content list; extract text
        if result.content and len(result.content) > 0:
            import json
            text = result.content[0].text
            try:
                return json.loads(text)
            except (json.JSONDecodeError, AttributeError):
                return {"raw": text}
        return {}

    async def list_sheets(self, spreadsheet_id: str) -> list[str]:
        result = await self._call_tool("list_sheets", {"spreadsheet_id": spreadsheet_id})
        return result.get("sheets", [])

    async def get_sheet_data(self, spreadsheet_id: str, sheet_name: str) -> SheetData | None:
        result = await self._call_tool("read_sheet", {
            "spreadsheet_id": spreadsheet_id,
            "sheet_name": sheet_name,
        })
        if not result or "raw" in result:
            return None

        headers = result.get("headers", [])
        raw_rows = result.get("rows", [])

        # Parse language headers: "English(en)" -> Language(code="en", label="English")
        languages = []
        for h in headers[1:]:  # skip 'key' column
            m = re.match(r"(.+)\((\w+)\)", h)
            if m:
                languages.append(Language(code=m.group(2), label=m.group(1), isSource=False))

        # First language is source by default (can be overridden by sheet settings)
        if languages:
            languages[0].isSource = True

        # Convert rows to dicts
        rows = []
        for raw_row in raw_rows:
            row = {"key": raw_row[0] if raw_row else ""}
            for i, lang in enumerate(languages):
                row[lang.code] = raw_row[i + 1] if i + 1 < len(raw_row) else ""
            rows.append(row)

        return SheetData(
            sheetName=sheet_name,
            headers=headers,
            languages=languages,
            rows=rows,
        )

    async def update_cells(self, spreadsheet_id: str, sheet_name: str, updates: list[dict]) -> bool:
        await self._call_tool("batch_update_cells", {
            "spreadsheet_id": spreadsheet_id,
            "sheet_name": sheet_name,
            "updates": updates,
        })
        return True
```

**Step 2: Implement sheets router**

`backend/routers/sheets.py`:
```python
from fastapi import APIRouter, HTTPException, Request
from backend.models import SheetData, RowUpdate
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["sheets"])
project_service = ProjectService()


@router.get("/sheets", response_model=list[str])
async def list_sheets(project_id: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    return await sheets_svc.list_sheets(project.spreadsheetId)


@router.get("/sheets/{sheet_name}", response_model=SheetData)
async def get_sheet_data(project_id: str, sheet_name: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    data = await sheets_svc.get_sheet_data(project.spreadsheetId, sheet_name)
    if not data:
        raise HTTPException(404, "Sheet not found")
    return data


@router.put("/sheets/{sheet_name}/rows")
async def update_rows(project_id: str, sheet_name: str, updates: list[RowUpdate], request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    sheets_svc = request.app.state.sheets_service
    await sheets_svc.update_cells(
        project.spreadsheetId,
        sheet_name,
        [u.model_dump() for u in updates],
    )
    return {"ok": True}
```

**Step 3: Verify syntax**

Run: `python -m py_compile backend/services/sheets_service.py && python -m py_compile backend/routers/sheets.py && echo "OK"`
Expected: `OK`

---

### Task 6: Job Service + Jobs Router (ADK Runner)

**Files:**
- Create: `backend/services/job_service.py`
- Create: `backend/routers/jobs.py`
- Create: `tests/test_job_service.py`

**Step 1: Write tests for job store (in-memory, no Runner)**

`tests/test_job_service.py`:
```python
from backend.services.job_service import JobService
from backend.models import JobStatus


def test_create_job():
    svc = JobService()
    job = svc.create_job("opal_app", "UI", "translate_all")
    assert job.status == JobStatus.pending
    assert job.projectId == "opal_app"
    assert job.sheetName == "UI"


def test_get_job():
    svc = JobService()
    created = svc.create_job("opal_app", "UI", "review")
    fetched = svc.get_job(created.jobId)
    assert fetched is not None
    assert fetched.jobId == created.jobId


def test_get_job_not_found():
    svc = JobService()
    assert svc.get_job("nonexistent") is None


def test_update_job_status():
    svc = JobService()
    job = svc.create_job("opal_app", "UI", "translate_all")
    svc.update_job(job.jobId, status=JobStatus.running, progress=50, processedKeys=4)
    updated = svc.get_job(job.jobId)
    assert updated.status == JobStatus.running
    assert updated.progress == 50
```

**Step 2: Run tests to verify fail**

Run: `pytest tests/test_job_service.py -v`
Expected: FAIL

**Step 3: Implement job service**

`backend/services/job_service.py`:
```python
import uuid
from datetime import datetime, timezone
from backend.models import TranslationJob, JobStatus, JobType, ReviewReport


class JobService:
    def __init__(self):
        self._jobs: dict[str, TranslationJob] = {}
        self._review_reports: dict[str, ReviewReport] = {}

    def create_job(self, project_id: str, sheet_name: str, job_type: str) -> TranslationJob:
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        job = TranslationJob(
            jobId=job_id,
            projectId=project_id,
            sheetName=sheet_name,
            type=JobType(job_type),
            status=JobStatus.pending,
            createdAt=datetime.now(timezone.utc).isoformat(),
        )
        self._jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> TranslationJob | None:
        return self._jobs.get(job_id)

    def update_job(self, job_id: str, **kwargs) -> None:
        job = self._jobs.get(job_id)
        if job:
            for k, v in kwargs.items():
                if hasattr(job, k):
                    setattr(job, k, v)

    def store_review_report(self, project_id: str, sheet_name: str, report: ReviewReport) -> None:
        key = f"{project_id}/{sheet_name}"
        self._review_reports[key] = report

    def get_review_report(self, project_id: str, sheet_name: str) -> ReviewReport | None:
        key = f"{project_id}/{sheet_name}"
        return self._review_reports.get(key)
```

**Step 4: Run tests**

Run: `pytest tests/test_job_service.py -v`
Expected: All 4 tests PASS

**Step 5: Implement jobs router**

`backend/routers/jobs.py`:
```python
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from backend.models import TranslationJob, JobCreatePayload, ReviewReport

router = APIRouter(tags=["jobs"])


@router.post("/api/projects/{project_id}/sheets/{sheet_name}/jobs", response_model=TranslationJob, status_code=201)
async def create_job(
    project_id: str,
    sheet_name: str,
    payload: JobCreatePayload,
    background_tasks: BackgroundTasks,
    request: Request,
):
    job_svc = request.app.state.job_service
    job = job_svc.create_job(project_id, sheet_name, payload.type.value)

    # Schedule agent execution in background
    background_tasks.add_task(run_agent_job, request.app, job.jobId)

    return job


@router.get("/api/jobs/{job_id}", response_model=TranslationJob)
async def get_job(job_id: str, request: Request):
    job_svc = request.app.state.job_service
    job = job_svc.get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/api/projects/{project_id}/sheets/{sheet_name}/review", response_model=ReviewReport)
async def get_review_report(project_id: str, sheet_name: str, request: Request):
    job_svc = request.app.state.job_service
    report = job_svc.get_review_report(project_id, sheet_name)
    if not report:
        raise HTTPException(404, "No review report found")
    return report


async def run_agent_job(app, job_id: str):
    """Background task: run ADK agent for a translation/review job."""
    job_svc = app.state.job_service
    job = job_svc.get_job(job_id)
    if not job:
        return

    from backend.models import JobStatus
    job_svc.update_job(job_id, status=JobStatus.running, progress=10)

    try:
        runner = app.state.runner
        session_service = app.state.session_service

        # Create a new session for this job
        session = await session_service.create_session(
            app_name="game_translator",
            user_id=job.projectId,
        )

        # Build the user message based on job type
        if job.type.value == "translate_all":
            user_msg = f"Translate the {job.sheetName} sheet for the {job.projectId} project. Translate all keys to all target languages."
        elif job.type.value == "update":
            user_msg = f"Update translations for the {job.sheetName} sheet in the {job.projectId} project."
        elif job.type.value == "review":
            user_msg = f"Review the translations in the {job.sheetName} sheet for the {job.projectId} project. Return a JSON report with issues."
        else:
            user_msg = f"Process the {job.sheetName} sheet for the {job.projectId} project."

        from google.adk.runners import Runner
        from google.genai import types

        content = types.Content(
            role="user",
            parts=[types.Part(text=user_msg)],
        )

        job_svc.update_job(job_id, progress=30)

        # Run agent
        response_text = ""
        async for event in runner.run_async(
            session_id=session.id,
            user_id=job.projectId,
            new_message=content,
        ):
            if hasattr(event, "content") and event.content and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text += part.text

        job_svc.update_job(job_id, status=JobStatus.completed, progress=100, processedKeys=job.totalKeys)

        # If review job, try to parse and store the report
        if job.type.value == "review" and response_text:
            import json
            try:
                report_data = json.loads(response_text)
                from backend.models import ReviewReport, ReviewIssue
                from datetime import datetime, timezone
                report = ReviewReport(
                    projectId=job.projectId,
                    sheetName=job.sheetName,
                    totalKeys=report_data.get("total_keys", 0),
                    reviewedKeys=report_data.get("reviewed_keys", 0),
                    issues=[ReviewIssue(**i) for i in report_data.get("issues", [])],
                    createdAt=datetime.now(timezone.utc).isoformat(),
                )
                job_svc.store_review_report(job.projectId, job.sheetName, report)
            except (json.JSONDecodeError, Exception):
                pass  # Agent response wasn't parseable JSON — ok for v0

    except Exception as e:
        job_svc.update_job(job_id, status=JobStatus.failed, error=str(e))
```

**Step 6: Verify syntax**

Run: `python -m py_compile backend/routers/jobs.py && echo "OK"`
Expected: `OK`

---

### Task 7: Main App Wiring + Lifespan + Integration Verification

**Files:**
- Modify: `backend/main.py`

**Step 1: Update main.py with full wiring**

`backend/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    from backend.services.sheets_service import SheetsService
    from backend.services.job_service import JobService

    # Sheets MCP client
    sheets_service = SheetsService()
    try:
        await sheets_service.connect()
    except Exception as e:
        print(f"[WARN] MCP Sheets connection failed: {e}. Sheet endpoints will not work.")
        sheets_service = SheetsService()  # unconnected fallback

    app.state.sheets_service = sheets_service
    app.state.job_service = JobService()

    # ADK Runner + Session Service
    try:
        from google.adk.runners import Runner
        from google.adk.sessions import DatabaseSessionService
        from game_translator import root_agent

        session_service = DatabaseSessionService(db_url="sqlite+aiosqlite:///./sessions.db")
        runner = Runner(
            agent=root_agent,
            session_service=session_service,
            app_name="game_translator",
        )
        app.state.session_service = session_service
        app.state.runner = runner
    except Exception as e:
        print(f"[WARN] ADK Runner init failed: {e}. Job execution will not work.")
        app.state.session_service = None
        app.state.runner = None

    yield

    # --- Shutdown ---
    await sheets_service.disconnect()


app = FastAPI(title="Game Translator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from backend.routers import projects, config, sheets, jobs

app.include_router(projects.router)
app.include_router(config.router)
app.include_router(sheets.router)
app.include_router(jobs.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

**Step 2: Run all tests**

Run: `pytest tests/ -v`
Expected: All tests pass (project, config, glossary, job service tests).

**Step 3: Verify server starts**

Run: `uvicorn backend.main:app --port 8000`
Expected: Server starts without import errors. MCP/Runner warnings are OK if no credentials configured.

**Step 4: Verify frontend connection**

1. In `frontend/.env`, set `VITE_MOCK_API=false`
2. Run `cd frontend && npm run dev`
3. Run `uvicorn backend.main:app --port 8000`
4. Open `http://localhost:5173` — Projects page should load (from YAML files)
5. Navigate to a project — Glossary, Style Guide, Sheet Settings should work (YAML CRUD)
6. Sheets viewer requires MCP connection (needs service account)

**Step 5: Update existing opal_app config.yaml to include full metadata**

Update `projects/opal_app/config.yaml` to include fields the backend needs:
```yaml
name: "Opal App"
description: "Mobile puzzle game localization"
spreadsheet_id: "1abc123_example"
default_source_language: "en"
created_at: "2026-01-15T09:00:00Z"
sheet_count: 3
last_translated_at: null
```
