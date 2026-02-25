# Language Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add project-level language management (locale presets, custom input, language deletion with CSV sync), sheet-level visibility control (eye icons), and source language dropdown — matching Pencil designs.

**Architecture:** Backend adds `languages` section to config.yaml as the project language pool, with API endpoints for CRUD. Sheet creation uses project languages for CSV headers. Frontend adds Languages settings page, improves SheetSettings with dropdown, and adds eye icons in DataTable for column visibility. Pencil design node IDs: Language Settings (Y8AuV), Sheet Viewer (Er1uw), Sheet Settings (bPehR).

**Tech Stack:** Python/FastAPI (backend), React/TypeScript/TanStack Query (frontend), pytest (backend tests)

---

### Task 1: Fix CSV locale regex to support hyphens

The regex `\w+` in `sheets_service.py` doesn't match locale codes with hyphens (`zh-Hans`, `zh-TW`, `pt-BR`). Three locations need fixing.

**Files:**
- Modify: `backend/services/sheets_service.py` (lines 37, 79, 154)
- Test: `tests/test_sheets_service.py`

**Step 1: Write failing test**

Add to `tests/test_sheets_service.py`:

```python
@pytest.fixture
def svc_hyphen(tmp_path):
    """SheetsService with hyphenated locale codes."""
    project_dir = tmp_path / "projects" / "test_proj" / "sheets"
    project_dir.mkdir(parents=True)
    csv_path = project_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Key", "English(en)", "Chinese (Simplified)(zh-Hans)", "Portuguese(pt-BR)"])
        writer.writerow(["btn_start", "Start", "开始", "Iniciar"])
    s = SheetsService(projects_dir=tmp_path / "projects")
    return s


def test_parse_hyphenated_locale_codes(svc_hyphen):
    data = svc_hyphen.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "zh-Hans" in codes
    assert "pt-BR" in codes


def test_update_cells_hyphenated_code(svc_hyphen):
    ok = svc_hyphen.update_cells("test_proj", "UI", [{"key": "btn_start", "lang_code": "zh-Hans", "value": "启动"}])
    assert ok is True
    data = svc_hyphen.get_sheet_data("test_proj", "UI")
    row = next(r for r in data.rows if r["key"] == "btn_start")
    assert row["zh-Hans"] == "启动"


def test_delete_language_hyphenated_code(svc_hyphen):
    deleted = svc_hyphen.delete_language("test_proj", "UI", "zh-Hans")
    assert deleted >= 0
    data = svc_hyphen.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "zh-Hans" not in codes
```

**Step 2: Run tests to verify they fail**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_sheets_service.py::test_parse_hyphenated_locale_codes tests/test_sheets_service.py::test_update_cells_hyphenated_code tests/test_sheets_service.py::test_delete_language_hyphenated_code -v`
Expected: FAIL — `zh-Hans` not parsed because `\w+` doesn't match hyphens.

**Step 3: Fix the regex in three locations**

In `backend/services/sheets_service.py`, change `\w+` to `[^)]+` in three places:

- Line 37: `r"(.+)\((\w+)\)"` → `r"(.+)\(([^)]+)\)"`
- Line 79: `r".+\((\w+)\)"` → `r".+\(([^)]+)\)"`
- Line 154: `r".+\((\w+)\)"` → `r".+\(([^)]+)\)"`

**Step 4: Run tests to verify they pass**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_sheets_service.py -v`
Expected: ALL PASS

**Step 5: Fix CSV header key casing**

In `backend/services/sheets_service.py` line 238, change `headers = ["key"]` to `headers = ["Key"]`.

Also update `svc` fixture in `tests/test_sheets_service.py` to use uppercase `Key` in the CSV header to match Unity format (the code reads `raw_row[0]` regardless of header name, so the internal dict key stays `"key"`).

**Step 6: Run all tests**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/ -v`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add backend/services/sheets_service.py tests/test_sheets_service.py
git commit -m "fix: support hyphenated locale codes in CSV parsing and uppercase Key header"
```

---

### Task 2: Project language models and config service

Add `languages` section handling to config.yaml and new Pydantic models.

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/services/config_service.py`
- Test: `tests/test_config.py`

**Step 1: Write failing tests**

Add to `tests/test_config.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_config.py::test_get_project_languages_empty tests/test_config.py::test_add_project_language -v`
Expected: FAIL — methods don't exist yet

**Step 3: Add model**

In `backend/models.py`, add after the `Language` class:

```python
class ProjectLanguage(_CamelModel):
    code: str
    label: str
```

Also add:

```python
class AddLanguagePayload(_CamelModel):
    code: str
    label: str
```

(This already exists — reuse it for project-level too.)

Add a new payload for project language deletion impact:

```python
class LanguageDeleteImpact(_CamelModel):
    code: str
    affected_sheets: int
    affected_translations: int
```

**Step 4: Add service methods**

In `backend/services/config_service.py`, add imports and methods:

```python
from backend.models import ProjectLanguage  # add to imports

# --- Project Languages ---

def get_project_languages(self, project_id: str) -> list[ProjectLanguage]:
    cfg = self._read_config(project_id)
    raw = cfg.get("languages") or []
    return [ProjectLanguage(code=l["code"], label=l["label"]) for l in raw]

def add_project_language(self, project_id: str, code: str, label: str) -> ProjectLanguage | None:
    cfg = self._read_config(project_id)
    langs = cfg.get("languages") or []
    if any(l["code"] == code for l in langs):
        return None  # duplicate
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
```

**Step 5: Run tests**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_config.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/models.py backend/services/config_service.py tests/test_config.py
git commit -m "feat: add project language management to config service"
```

---

### Task 3: Project language API endpoints

**Files:**
- Create: `backend/routers/languages.py`
- Modify: `backend/main.py` (register router)
- Test: `tests/test_languages_api.py`

**Step 1: Write failing API tests**

Create `tests/test_languages_api.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.config_service import ConfigService


@pytest.fixture
def client(tmp_path):
    config_svc = ConfigService(projects_dir=tmp_path / "projects")
    (tmp_path / "projects" / "test_proj").mkdir(parents=True)

    fake_project = MagicMock()
    with patch("backend.routers.languages.project_service") as mock_ps:
        mock_ps.get_project.return_value = fake_project
        with TestClient(app) as c:
            app.state.config_service = config_svc
            yield c


def test_list_project_languages_empty(client):
    resp = client.get("/api/projects/test_proj/languages")
    assert resp.status_code == 200
    assert resp.json() == []


def test_add_project_language(client):
    resp = client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["code"] == "en"
    assert data["label"] == "English"


def test_add_project_language_duplicate_409(client):
    client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    resp = client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    assert resp.status_code == 409


def test_delete_project_language(client):
    client.post("/api/projects/test_proj/languages", json={"code": "en", "label": "English"})
    resp = client.delete("/api/projects/test_proj/languages/en")
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
```

**Step 2: Run tests to verify they fail**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_languages_api.py -v`
Expected: FAIL — router doesn't exist

**Step 3: Create the router**

Create `backend/routers/languages.py`:

```python
from fastapi import APIRouter, HTTPException, Request
from backend.models import AddLanguagePayload, ProjectLanguage
from backend.services.project_service import ProjectService

router = APIRouter(prefix="/api/projects/{project_id}", tags=["languages"])
project_service = ProjectService()


@router.get("/languages", response_model=list[ProjectLanguage])
async def list_project_languages(project_id: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    return config_svc.get_project_languages(project_id)


@router.post("/languages", status_code=201, response_model=ProjectLanguage)
async def add_project_language(project_id: str, payload: AddLanguagePayload, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    lang = config_svc.add_project_language(project_id, payload.code, payload.label)
    if lang is None:
        raise HTTPException(409, "Language already exists")
    return lang


@router.delete("/languages/{code}")
async def delete_project_language(project_id: str, code: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    ok = config_svc.delete_project_language(project_id, code)
    if not ok:
        raise HTTPException(404, "Language not found")
    return {"ok": True}
```

**Step 4: Register router in main.py**

In `backend/main.py`, add:
```python
from backend.routers.languages import router as languages_router
app.include_router(languages_router)
```

**Step 5: Run tests**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_languages_api.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/routers/languages.py backend/main.py tests/test_languages_api.py
git commit -m "feat: add project language API endpoints"
```

---

### Task 4: Update sheet creation to use project languages

When creating a sheet, CSV headers should come from project `languages` in config.yaml, not copied from existing sheets.

**Files:**
- Modify: `backend/services/sheets_service.py` (create_sheet method)
- Test: `tests/test_sheets_service.py`

**Step 1: Write failing test**

Add to `tests/test_sheets_service.py`:

```python
def test_create_sheet_uses_project_languages(tmp_path):
    """When project has languages in config, new sheet uses those for headers."""
    import yaml
    proj_dir = tmp_path / "projects" / "test_proj"
    sheets_dir = proj_dir / "sheets"
    sheets_dir.mkdir(parents=True)

    # Write config with languages
    config = {"languages": [{"code": "en", "label": "English"}, {"code": "zh-Hans", "label": "Chinese (Simplified)"}]}
    with open(proj_dir / "config.yaml", "w") as f:
        yaml.dump(config, f)

    svc = SheetsService(projects_dir=tmp_path / "projects")
    svc.create_sheet("test_proj", "NewSheet")
    data = svc.get_sheet_data("test_proj", "NewSheet")
    assert data.headers == ["Key", "English(en)", "Chinese (Simplified)(zh-Hans)"]
    assert len(data.languages) == 2
```

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_sheets_service.py::test_create_sheet_uses_project_languages -v`
Expected: FAIL

**Step 3: Update create_sheet**

Modify `create_sheet` in `backend/services/sheets_service.py`:

```python
def create_sheet(self, project_id: str, sheet_name: str) -> bool:
    """Create a new empty CSV sheet using project language config for headers."""
    sheets_dir = self.projects_dir / project_id / "sheets"
    sheets_dir.mkdir(parents=True, exist_ok=True)
    csv_path = sheets_dir / f"{sheet_name}.csv"
    if csv_path.exists():
        return False

    # Try to read languages from project config.yaml
    import yaml
    config_path = self.projects_dir / project_id / "config.yaml"
    headers = ["Key"]
    if config_path.exists():
        with open(config_path) as f:
            cfg = yaml.safe_load(f) or {}
        langs = cfg.get("languages") or []
        if langs:
            headers = ["Key"] + [f"{l['label']}({l['code']})" for l in langs]

    # Fallback: copy from existing sheet if no project languages
    if len(headers) == 1:
        existing = sorted(sheets_dir.glob("*.csv"))
        if existing:
            with open(existing[0], newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                first_row = next(reader, None)
                if first_row:
                    headers = first_row

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

    return True
```

**Step 4: Run tests**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_sheets_service.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/services/sheets_service.py tests/test_sheets_service.py
git commit -m "feat: sheet creation uses project languages from config.yaml"
```

---

### Task 5: Project language deletion with CSV column sync

When a language is deleted from the project, remove the corresponding column from ALL sheet CSVs.

**Files:**
- Modify: `backend/services/config_service.py`
- Modify: `backend/routers/languages.py`
- Test: `tests/test_languages_api.py`

**Step 1: Write failing test**

Add to `tests/test_languages_api.py`:

```python
import csv

@pytest.fixture
def client_with_sheets(tmp_path):
    """Client with sheets that have language columns."""
    proj_dir = tmp_path / "projects" / "test_proj"
    sheets_dir = proj_dir / "sheets"
    sheets_dir.mkdir(parents=True)

    # Create config with languages
    import yaml
    cfg = {"languages": [{"code": "en", "label": "English"}, {"code": "ja", "label": "Japanese"}]}
    with open(proj_dir / "config.yaml", "w") as f:
        yaml.dump(cfg, f)

    # Create a sheet CSV
    csv_path = sheets_dir / "UI.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Key", "English(en)", "Japanese(ja)"])
        writer.writerow(["btn_start", "Start", "スタート"])

    from backend.services.config_service import ConfigService
    from backend.services.sheets_service import SheetsService
    config_svc = ConfigService(projects_dir=tmp_path / "projects")
    sheets_svc = SheetsService(projects_dir=tmp_path / "projects")

    fake_project = MagicMock()
    with patch("backend.routers.languages.project_service") as mock_ps:
        mock_ps.get_project.return_value = fake_project
        with TestClient(app) as c:
            app.state.config_service = config_svc
            app.state.sheets_service = sheets_svc
            yield c, sheets_svc


def test_delete_language_syncs_csv_columns(client_with_sheets):
    client, sheets_svc = client_with_sheets
    resp = client.delete("/api/projects/test_proj/languages/ja")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["affectedSheets"] == 1
    assert body["affectedTranslations"] == 1

    # Verify CSV column was removed
    data = sheets_svc.get_sheet_data("test_proj", "UI")
    codes = [l.code for l in data.languages]
    assert "ja" not in codes
```

**Step 2: Run test to verify it fails**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_languages_api.py::test_delete_language_syncs_csv_columns -v`
Expected: FAIL

**Step 3: Add CSV sync method to SheetsService**

Add to `backend/services/sheets_service.py`:

```python
def delete_language_from_all_sheets(self, project_id: str, code: str) -> dict:
    """Delete a language column from all CSV sheets. Returns stats."""
    sheets_dir = self.projects_dir / project_id / "sheets"
    if not sheets_dir.exists():
        return {"affected_sheets": 0, "affected_translations": 0}

    affected_sheets = 0
    affected_translations = 0

    for csv_file in sorted(sheets_dir.glob("*.csv")):
        count = self.delete_language(project_id, csv_file.stem, code)
        if count >= 0:
            affected_sheets += 1
            affected_translations += count

    return {"affected_sheets": affected_sheets, "affected_translations": affected_translations}
```

**Step 4: Update delete endpoint to sync CSVs**

Update `backend/routers/languages.py` `delete_project_language`:

```python
@router.delete("/languages/{code}")
async def delete_project_language(project_id: str, code: str, request: Request):
    project = project_service.get_project(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    config_svc = request.app.state.config_service
    ok = config_svc.delete_project_language(project_id, code)
    if not ok:
        raise HTTPException(404, "Language not found")

    # Sync: remove column from all sheet CSVs
    sheets_svc = request.app.state.sheets_service
    stats = sheets_svc.delete_language_from_all_sheets(project_id, code)

    return {
        "ok": True,
        "affectedSheets": stats["affected_sheets"],
        "affectedTranslations": stats["affected_translations"],
    }
```

**Step 5: Run tests**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/test_languages_api.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/services/sheets_service.py backend/routers/languages.py tests/test_languages_api.py
git commit -m "feat: project language deletion syncs CSV columns across all sheets"
```

---

### Task 6: Add visible_languages to SheetSettings

**Files:**
- Modify: `backend/models.py`
- Modify: `frontend/src/types/sheetSettings.ts`

**Step 1: Add field to backend model**

In `backend/models.py`, add to `SheetSettings`:

```python
class SheetSettings(_CamelModel):
    source_language: str | None = None
    translation_style: str | None = None
    character_limit: int | None = None
    glossary_override: str | None = None
    instructions: str | None = None
    visible_languages: list[str] | None = None
```

**Step 2: Run backend tests to verify nothing breaks**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/ -v`
Expected: ALL PASS

**Step 3: Add field to frontend type**

In `frontend/src/types/sheetSettings.ts`, add `visibleLanguages`:

```typescript
export interface SheetSettings {
  sourceLanguage: string | null
  translationStyle: string | null
  characterLimit: number | null
  glossaryOverride: string | null
  instructions: string | null
  visibleLanguages: string[] | null
}
```

**Step 4: Update mock data defaults**

In `frontend/src/api/mock/handlers.ts`, update the SheetSettings defaults to include `visibleLanguages: null`.

In `frontend/src/api/mock/data.ts`, update `mockProjectDefaults` and `mockSheetSettings` to include `visibleLanguages: null`.

**Step 5: Commit**

```bash
git add backend/models.py frontend/src/types/sheetSettings.ts frontend/src/api/mock/handlers.ts frontend/src/api/mock/data.ts
git commit -m "feat: add visibleLanguages field to SheetSettings"
```

---

### Task 7: Frontend types, API, mock, hooks for project languages

**Files:**
- Create: `frontend/src/types/language.ts`
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/languages.ts`
- Modify: `frontend/src/api/mock/handlers.ts`
- Modify: `frontend/src/api/mock/data.ts`
- Modify: `frontend/src/lib/constants.ts`
- Create: `frontend/src/hooks/useProjectLanguages.ts`

**Step 1: Create language type**

Create `frontend/src/types/language.ts`:

```typescript
export interface ProjectLanguage {
  code: string
  label: string
}

export interface LanguageDeleteResult {
  ok: boolean
  affectedSheets: number
  affectedTranslations: number
}
```

**Step 2: Export from types/index.ts**

Add `export * from './language'` to `frontend/src/types/index.ts`.

**Step 3: Add locale presets constant**

Create `frontend/src/lib/localePresets.ts`:

```typescript
import type { ProjectLanguage } from '../types'

export const TIER1_PRESETS: ProjectLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'it', label: 'Italian' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'pt', label: 'Portuguese' },
]

export const TIER2_PRESETS: ProjectLanguage[] = [
  { code: 'pt-BR', label: 'Portuguese (Brazil)' },
  { code: 'ru', label: 'Russian' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'th', label: 'Thai' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'id', label: 'Indonesian' },
  { code: 'ar', label: 'Arabic' },
]
```

**Step 4: Create API functions**

Create `frontend/src/api/languages.ts`:

```typescript
import { api } from './client'
import type { ProjectLanguage, LanguageDeleteResult } from '../types'

export function fetchProjectLanguages(projectId: string) {
  return api<ProjectLanguage[]>('GET', `/api/projects/${projectId}/languages`)
}

export function addProjectLanguage(projectId: string, code: string, label: string) {
  return api<ProjectLanguage>('POST', `/api/projects/${projectId}/languages`, { code, label })
}

export function deleteProjectLanguage(projectId: string, code: string) {
  return api<LanguageDeleteResult>('DELETE', `/api/projects/${projectId}/languages/${encodeURIComponent(code)}`)
}
```

**Step 5: Add query key**

In `frontend/src/lib/constants.ts`, add:

```typescript
projectLanguages: (projectId: string) => ['projectLanguages', projectId] as const,
```

**Step 6: Add mock data and handlers**

In `frontend/src/api/mock/data.ts`, add:

```typescript
import type { ProjectLanguage } from '../../types'

export const mockProjectLanguages: Record<string, ProjectLanguage[]> = {
  opal_app: [
    { code: 'en', label: 'English' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
  ],
  ruby_rpg: [],
}
```

In `frontend/src/api/mock/handlers.ts`, add import and handlers for:
- `GET /api/projects/:projectId/languages` → return mockProjectLanguages
- `POST /api/projects/:projectId/languages` → add to array, return language
- `DELETE /api/projects/:projectId/languages/:code` → remove, calculate affected stats from mockSheetData

**Step 7: Create hook**

Create `frontend/src/hooks/useProjectLanguages.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchProjectLanguages, addProjectLanguage, deleteProjectLanguage } from '../api/languages'
import { QUERY_KEYS } from '../lib/constants'

export function useProjectLanguages(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.projectLanguages(projectId),
    queryFn: () => fetchProjectLanguages(projectId),
  })
}

export function useAddProjectLanguage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ code, label }: { code: string; label: string }) =>
      addProjectLanguage(projectId, code, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectLanguages(projectId) })
    },
  })
}

export function useDeleteProjectLanguage(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => deleteProjectLanguage(projectId, code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectLanguages(projectId) })
    },
  })
}
```

**Step 8: Verify frontend compiles**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend && npx tsc --noEmit`
Expected: No errors

**Step 9: Commit**

```bash
git add frontend/src/types/language.ts frontend/src/types/index.ts frontend/src/api/languages.ts frontend/src/lib/localePresets.ts frontend/src/lib/constants.ts frontend/src/hooks/useProjectLanguages.ts frontend/src/api/mock/data.ts frontend/src/api/mock/handlers.ts
git commit -m "feat: add project language types, API, mock handlers, and hooks"
```

---

### Task 8: Languages settings page

Create the Language Settings page matching Pencil design (node Y8AuV). Key elements: Quick Add Presets section (Tier 1/Tier 2 chips with "Add All" buttons), Custom Language input (Locale Code + Display Name + Add button), Languages table with delete icons, delete confirmation dialog.

**Files:**
- Create: `frontend/src/pages/LanguageSettings.tsx`
- Create: `frontend/src/components/DeleteProjectLanguageDialog.tsx`

**Step 1: Create delete confirmation dialog**

Create `frontend/src/components/DeleteProjectLanguageDialog.tsx`:

A Modal showing "Delete {label}?" with affected sheets count and translations count. "Delete" (destructive) and "Cancel" buttons.

Props: `open`, `onClose`, `onConfirm`, `languageLabel`, `affectedSheets`, `affectedTranslations`, `isPending`.

**Step 2: Create LanguageSettings page**

Create `frontend/src/pages/LanguageSettings.tsx` with:

1. **Page header**: "Languages" title, "{N} languages configured" description
2. **Quick Add Presets** section:
   - "Tier 1 · EFIGS + CJK" label with Tier 1 preset chips (blue filled for already-added, outline for available). "Add All" button.
   - "Tier 2" label with Tier 2 preset chips. "Add All" button.
   - Chips use `bg-[var(--primary-light)] text-[var(--primary)]` for added, `border border-[var(--border)]` for available.
   - Clicking an available chip adds it. Already-added chips are non-interactive.
3. **Custom Language** section:
   - Two inputs: Locale Code, Display Name
   - "Add" button (primary)
4. **Languages table**:
   - Columns: Language, Code, CSV Header, Actions (trash icon)
   - CSV Header column shows the Unity format: `{label}({code})`
   - Trash icon → opens delete confirmation dialog

Design reference: Pencil node Y8AuV. Match the layout with sidebar showing "Languages" as active.

**Step 3: Verify it renders**

Run: `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend && npm run dev`
Navigate to `/projects/opal_app/languages`. Verify it renders.

**Step 4: Commit**

```bash
git add frontend/src/pages/LanguageSettings.tsx frontend/src/components/DeleteProjectLanguageDialog.tsx
git commit -m "feat: add Languages settings page with presets and custom input"
```

---

### Task 9: Sidebar and routing update

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Add Languages link to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, add a "Languages" NavLink in the Config section, before "Glossary":

```tsx
<NavLink to={`/projects/${projectId}/languages`} className={configLinkClass}>
  Languages
</NavLink>
```

**Step 2: Add route in App.tsx**

In `frontend/src/App.tsx`:

```tsx
const LanguageSettings = lazy(() => import('./pages/LanguageSettings'))

// Inside the ProjectLayout routes:
<Route path="languages" element={<LanguageSettings />} />
```

**Step 3: Verify navigation works**

Run dev server, click "Languages" in sidebar, verify page loads.

**Step 4: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat: add Languages route and sidebar link"
```

---

### Task 10: Sheet Settings source language dropdown

Replace the text input for Source Language with a dropdown populated from project languages. Matches Pencil design (node bPehR).

**Files:**
- Modify: `frontend/src/components/SheetSettingsDialog.tsx`

**Step 1: Update SheetSettingsDialog**

In `frontend/src/components/SheetSettingsDialog.tsx`:

1. Import `useProjectLanguages` hook
2. Fetch project languages: `const { data: projectLangs } = useProjectLanguages(projectId)`
3. Replace the Source Language `<Input>` with a `<select>` element:
   - Default option: placeholder showing project default (e.g., "English (en)")
   - Options from `projectLangs` list: `{label} ({code})`
   - Styled to match Pencil design: rounded border, padding, same height as Input

The dropdown should look like (matching Pencil node bPehR):
```tsx
<div className="flex flex-col gap-1.5">
  <label className="text-sm font-medium text-[var(--foreground)]">Source Language</label>
  <div className="relative">
    <select
      value={form.sourceLanguage ?? ''}
      onChange={(e) => setForm({ ...form, sourceLanguage: e.target.value || null })}
      className="w-full px-3 py-2 border border-[var(--border)] rounded-[var(--radius-md)] text-sm bg-white appearance-none pr-8 outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent"
    >
      <option value="">{defaults?.sourceLanguage ? `${defaultLabel} (project default)` : 'Select...'}</option>
      {projectLangs?.map((lang) => (
        <option key={lang.code} value={lang.code}>{lang.label} ({lang.code})</option>
      ))}
    </select>
    {/* Chevron icon */}
    <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" .../>
  </div>
</div>
```

**Step 2: Verify in dev server**

Open Sheet Settings modal, verify dropdown shows project languages, chevron icon visible.

**Step 3: Commit**

```bash
git add frontend/src/components/SheetSettingsDialog.tsx
git commit -m "feat: replace source language text input with dropdown from project languages"
```

---

### Task 11: Language visibility eye icons in DataTable

Add eye/eye-off toggle icons on language column headers. Clicking toggles visibility via sheet settings.

**Files:**
- Modify: `frontend/src/components/DataTable.tsx`
- Modify: `frontend/src/pages/SheetViewer.tsx`

**Step 1: Add visibility props to DataTable**

In `frontend/src/components/DataTable.tsx`, add props:

```typescript
interface DataTableProps {
  data: SheetData
  disabled?: boolean
  visibleLanguages?: string[] | null  // null = all visible
  onCellSave: (key: string, langCode: string, value: string) => void
  onDeleteLanguage?: (code: string) => void
  onAddLanguage?: () => void
  onAddRow?: (key: string) => void
  onDeleteRows?: (keys: string[]) => void
  onToggleVisibility?: (code: string) => void
}
```

**Step 2: Filter displayed languages and add eye icons**

Inside DataTable:
- Compute `displayedLanguages` = if `visibleLanguages` is null/undefined, show all; else filter `data.languages` to only those in `visibleLanguages`.
- In the header, use `data.languages` (ALL languages) for the header row so eye icons appear for all.
- For each language header, add an eye icon button:
  - If visible (in displayedLanguages): open eye icon, clicking calls `onToggleVisibility(code)` to hide
  - If hidden: closed eye icon, clicking calls `onToggleVisibility(code)` to show
- In the body rows, only show cells for `displayedLanguages`.

Eye icon SVGs (matching Pencil design Er1uw):
- Open eye: `<svg viewBox="0 0 24 24">` eye path
- Closed eye: `<svg viewBox="0 0 24 24">` eye-off path

**Step 3: Wire up in SheetViewer**

In `frontend/src/pages/SheetViewer.tsx`:

1. Import `useSheetSettings` and `useUpdateSheetSettings`
2. Get current `visibleLanguages` from sheet settings
3. Pass `visibleLanguages` and `onToggleVisibility` to DataTable
4. `onToggleVisibility` handler: toggles the language code in the `visibleLanguages` array and updates sheet settings

```typescript
const handleToggleVisibility = (code: string) => {
  const current = settingsData?.settings.visibleLanguages
  let next: string[]
  if (!current) {
    // Currently all visible, hide this one
    next = data!.languages.map(l => l.code).filter(c => c !== code)
  } else if (current.includes(code)) {
    next = current.filter(c => c !== code)
  } else {
    next = [...current, code]
  }
  // If all are visible again, set to null
  const allCodes = data!.languages.map(l => l.code)
  const newVisible = next.length === allCodes.length ? null : next
  updateSettings.mutate({ ...settingsData!.settings, visibleLanguages: newVisible })
}
```

**Step 4: Verify in dev server**

Open Sheet Viewer, verify eye icons appear on language headers. Click to toggle visibility. Verify columns hide/show.

**Step 5: Commit**

```bash
git add frontend/src/components/DataTable.tsx frontend/src/pages/SheetViewer.tsx
git commit -m "feat: add language visibility toggle with eye icons in sheet viewer"
```

---

### Task 12: Visual verification against Pencil designs

**IMPORTANT**: This task ensures the implementation matches the Pencil designs exactly.

**Files:** No files to modify — visual comparison only.

**Step 1: Take Pencil design screenshots**

Use `mcp__pencil__get_screenshot` for each design node:
- Language Settings: node Y8AuV
- Sheet Viewer (improved): node Er1uw
- Sheet Settings (improved): node bPehR

**Step 2: Run frontend dev server and compare**

Navigate to each screen and visually compare against the Pencil screenshots:

1. **Languages page** (`/projects/opal_app/languages`): Compare with Y8AuV
   - [ ] Quick Add Presets section with Tier 1/Tier 2 chips
   - [ ] Tier 1 chips: blue filled for added, outline for available
   - [ ] "Add All" buttons for each tier
   - [ ] Custom Language input with Locale Code + Display Name + Add button
   - [ ] Languages table with Language, Code, CSV Header columns
   - [ ] Trash icon for each row
   - [ ] "Languages" active in sidebar

2. **Sheet Viewer** (`/projects/opal_app/sheets/UI`): Compare with Er1uw
   - [ ] Eye icons on language column headers
   - [ ] Eye-off state when hidden
   - [ ] "+" button at end of header

3. **Sheet Settings modal**: Compare with bPehR
   - [ ] Source Language as dropdown (not text input)
   - [ ] Chevron-down icon on dropdown
   - [ ] Project languages listed in dropdown options

**Step 3: Fix any visual discrepancies**

If colors, spacing, or layout don't match the Pencil designs, adjust the CSS classes to match the design variables:
- `--primary: #2563EB`
- `--primary-light: #EFF6FF`
- `--foreground: #18181B`
- `--muted-foreground: #71717A`
- `--border: #E4E4E7`
- `--destructive: #DC2626`
- `--radius-md: 8px`, `--radius-sm: 6px`

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix: visual alignment with Pencil designs"
```
