---
created: 2026-03-11 20:39
modified: 2026-03-11 20:51
session_id: dd2051fb
---

# Google Workspace CLI 연동 (v3) -- 구현 계획 (Revision 2)

## 현재 상태 요약

현재 시스템은 로컬 CSV 파일 기반으로 동작한다. 핵심 구조는 다음과 같다:

- **에이전트** (`/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/agent.py`): ADK `Agent` 클래스로 `root_agent` 구성. 도구 함수 6개(`read_sheet`, `write_sheet`, `get_project_config`, `get_sheet_context`, `get_glossary`, `get_style_guide`)를 직접 등록. 서브 에이전트 `translator_agent`, `reviewer_agent` 보유.
- **백엔드** (`backend/`): FastAPI. `SheetsService`가 CSV 파일 직접 읽기/쓰기, `JobService`가 인메모리 job 관리, `JobHistoryService`가 SQLite(`jobs.db`) 영속화, `ConfigService`가 YAML 기반 프로젝트 설정 관리.
- **프론트엔드** (`frontend/`): React 18 + TypeScript + Vite. 7개 화면. `SheetViewer`가 시트 데이터 표시 + 셀 편집 즉시 저장. `useTranslation` 훅이 WebSocket/polling으로 job 진행률 관리.
- **프로젝트 설정** (`projects/<name>/config.yaml`): `name`, `description`, `default_source_language`, `languages`, `sheet_settings` 등. `source` 타입 필드 없음.
- **의존성**: `google-adk>=1.0.0` (pyproject.toml). **실제 설치 버전은 1.25.1**.

### ADK 1.25.1 Skills API -- 검증 완료

ADK 1.25.1에서 `SkillToolset` API를 직접 검증했다. 결과:

- `from google.adk.tools.skill_toolset import SkillToolset` -- 존재 확인
- `SkillToolset.__init__(self, skills: list[models.Skill])` -- `Skill` 객체 리스트를 받음
- `Skill` 모델: `frontmatter: Frontmatter`, `instructions: str`, `resources: Resources`
- `Frontmatter` 모델: `name: str`, `description: str`, `allowed_tools: str | None`, `metadata: dict`
- `Resources` 모델: `references: dict[str,str]`, `assets: dict[str,str]`, `scripts: dict[str,Script]`
- `SkillToolset`은 `BaseToolset`을 상속하므로 `Agent(tools=[..., skill_toolset])` 형태로 전달 가능
- 에이전트에 등록하면 `load_skill`(이름으로 SKILL.md 로드), `load_skill_resource`(리소스 파일 로드) 두 도구가 자동 제공
- `process_llm_request`에서 사용 가능한 스킬 목록을 시스템 프롬프트에 XML 형태로 자동 주입

따라서 **ADK 1.26.0 업그레이드는 불필요**하다. 1.25.1에서 이미 SkillToolset이 사용 가능하다. pyproject.toml의 버전 핀만 `>=1.25.1`로 정확하게 맞춘다.

### 기존 코드 버그: locale 정규식

`game_translator/tools/sheets.py` 37행의 정규식 `r"(.+)\((\w+)\)"`는 하이픈 포함 locale 코드(`zh-Hans`, `pt-BR`)를 파싱하지 못한다. 백엔드 `sheets_service.py`에서는 `r"(.+)\(([^)]+)\)"`를 사용하여 정상 동작한다. 이 버그는 Stream 1에서 수정한다.

---

## 핵심 설계 결정 (리뷰 반영)

### DB 경로: `jobs.db` 단일 파일 + WAL 모드

`pending_translations` 테이블을 기존 `jobs.db`에 통합한다. 이유:
- `job_history` 테이블과 동일 DB에 두면 트랜잭션 일관성 유지 용이
- 에이전트 도구(`game_translator/tools/pending.py`)와 백엔드 서비스(`PendingTranslationsService`) 모두 동일 경로 `./jobs.db` 사용
- 경로 상수: `DB_PATH = Path(__file__).parent.parent.parent / "jobs.db"` (에이전트 도구), `self.db_path = "jobs.db"` (백엔드 서비스, 기존 `JobHistoryService`와 동일 패턴)

**WAL 모드 필수**: 에이전트 도구는 동기 `sqlite3`를, 백엔드 서비스는 비동기 `aiosqlite`를 사용한다. 두 프로세스(또는 스레드)가 동일 DB 파일에 동시 접근하면 기본 journal 모드에서 "database is locked" 에러가 발생한다. WAL(Write-Ahead Logging) 모드를 활성화하면 동시 읽기/쓰기가 허용된다. 세 군데에서 WAL을 설정한다:
1. `PendingTranslationsService.init_db()` -- `PRAGMA journal_mode=WAL`
2. `save_pending_translations()` (에이전트 도구) -- `conn.execute("PRAGMA journal_mode=WAL")`
3. `JobHistoryService.init_db()` -- 기존 코드에도 WAL 추가 권장 (동일 DB 파일이므로)

### Apply 충돌 해결: 낙관적 덮어쓰기 + 에러 리포팅

번역 실행과 Apply 사이에 Google Sheets가 외부에서 수정될 수 있다. 전략:
- **낙관적 덮어쓰기(accept-and-overwrite)** 채택. etag/revision 기반 충돌 감지는 gws CLI가 지원하지 않으므로 불가.
- Apply API에서 gws CLI의 batch_update 실패 시 에러를 그대로 프론트엔드에 전달
- Apply 실패 시 pending 데이터는 유지됨 (applied로 마킹하지 않음). 사용자가 재시도 가능.
- Apply 부분 실패(일부 셀만 업데이트됨) 대응: gws CLI의 batchUpdate는 원자적이므로 부분 실패 없음. 전체 성공 또는 전체 실패.

### gws CLI 에러 처리 전략

`GwsService`의 모든 subprocess 호출에 일관된 에러 처리를 적용한다:
- **타임아웃**: subprocess에 30초 타임아웃 설정. 초과 시 `GwsTimeoutError` raise
- **stderr 파싱**: gws CLI의 stderr 출력을 캡처하여 에러 메시지에 포함
- **인증 만료 감지**: stderr에 "unauthorized" 또는 "token expired" 포함 시 `GwsAuthError` raise, 프론트엔드에 재인증 필요 알림
- **재시도 없음**: gws CLI 실패는 대부분 인증/권한/네트워크 문제이므로 자동 재시도보다 사용자에게 즉시 보고
- **결과 JSON 파싱**: gws CLI의 stdout을 JSON으로 파싱, 파싱 실패 시 `GwsParseError` raise

### 프론트엔드 pending 상태 동기화: 수동 리프레시 + Apply 후 자동 갱신

- pending 개수는 SheetViewer 마운트 시 1회 조회 + 셀 편집/번역 완료 시 재조회
- TanStack Query의 `invalidateQueries`로 관리, 별도 WebSocket이나 polling 불필요
- Apply 완료 후 시트 데이터 + pending 개수 모두 invalidate

---

## 변경 범위 분석

### 1. ADK 1.25.1 SkillToolset 활용 + 에이전트 리팩터링

**변경 대상 파일:**
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/pyproject.toml` -- ADK 버전 핀 `>=1.25.1`로 명시
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/requirements.txt` -- 동일
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/agent.py` -- SkillToolset 도입, 에이전트 팩토리
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/__init__.py` -- export 유지
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/prompts.py` -- gws 관련 instruction 추가
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/tools/sheets.py` -- locale 정규식 버그 수정

**접근:**
- pyproject.toml에서 `google-adk>=1.25.1`로 핀 (1.26.0 불필요, 1.25.1에서 SkillToolset 확인 완료)
- `SkillToolset`을 사용해 gws-sheets 스킬을 `Skill` 객체로 구성하고 에이전트 `tools` 리스트에 포함
- 기존 CSV 도구는 그대로 유지 (CSV 프로젝트 호환)
- 에이전트 팩토리 함수로 source_type에 따라 도구 세트 동적 구성

### 2. gws CLI 연동 + 인증

**새 파일:**
- `backend/services/gws_service.py` -- gws CLI 래핑 서비스
- `backend/routers/gws.py` -- gws 인증 상태 확인 API

**접근:**
- `GwsService` 클래스에 타임아웃, stderr 파싱, 인증 만료 감지 포함
- 서버 부트 시 gws CLI 설치 여부 + 인증 상태 체크 (경고 로그, 블로킹 아님)
- 단위 테스트에서 `subprocess.run`을 mock으로 대체하는 `MockGwsRunner` fixture 제공

### 3. 번역 Apply 워크플로우 (SQLite 임시 저장)

**변경/새 파일:**
- `backend/services/pending_translations_service.py` (새) -- `jobs.db`에 `pending_translations` 테이블
- `backend/routers/translations.py` (새) -- 미적용 번역 조회, Apply API
- `backend/routers/jobs.py` -- gws 프로젝트 분기, write detection 로직 일반화

### 4. 프론트엔드 변경

**변경/새 파일:**
- `frontend/src/types/project.ts` -- `sourceType` 필드 추가
- `frontend/src/components/CreateProjectModal.tsx` -- 소스 타입 선택 UI
- `frontend/src/pages/SheetViewer.tsx` -- Apply 바 추가, pending 오버레이
- `frontend/src/api/sheets.ts` -- apply API 호출
- `frontend/src/components/ApplyBar.tsx` (새)
- `frontend/src/hooks/usePendingTranslations.ts` (새)

### 5. CSV/gws 프로젝트 공존

**변경 대상 파일:**
- `backend/models.py` -- `SourceType` enum, `Project` 확장
- `backend/services/project_service.py` -- source_type 저장/로드, sheet_count gws 분기
- `backend/routers/projects.py` -- create에 source_type/spreadsheet_id 전달
- `backend/routers/sheets.py` -- source_type에 따라 SheetsService vs GwsService 분기
- `backend/main.py` -- GwsService, PendingTranslationsService 초기화, 새 라우터 등록

### 6. 에이전트 구조 리팩터링

**변경/새 파일:**
- `game_translator/agent.py` -- 팩토리 함수
- `game_translator/skills/` (새 디렉토리) -- gws-sheets 스킬 정의
- `game_translator/tools/pending.py` (새) -- pending 저장 도구
- `backend/main.py` -- Runner 동적 생성 로직

---

## Work Streams (병렬 작업 단위)

### Stream 1: ADK SkillToolset 활용 + 에이전트 팩토리 기반 구축

**의존성:** 없음 (독립 시작 가능)
**담당 범위:** 에이전트 패키지 전체, locale 버그 수정

#### 작업 1.1: ADK 버전 핀 + locale 버그 수정

**파일:** `pyproject.toml`, `requirements.txt`, `game_translator/tools/sheets.py`

- `pyproject.toml`에서 `google-adk>=1.0.0`을 `google-adk>=1.25.1`로 변경 (1.25.1에서 SkillToolset 확인 완료이므로 1.26.0 불필요)
- `requirements.txt`에서 `google-adk>=1.0.0`을 `google-adk>=1.25.1`로 변경
- `game_translator/tools/sheets.py` 37행의 locale 파싱 정규식 수정:
  ```python
  # Before (hyphen locale 코드 실패):
  m = re.match(r"(.+)\((\w+)\)", h)
  # After (backend의 sheets_service.py와 동일 패턴):
  m = re.match(r"(.+)\(([^)]+)\)", h)
  ```
- 동일 파일 84행 `write_sheet`의 정규식도 동일하게 수정:
  ```python
  # Before:
  m = re.match(r".+\((\w+)\)", h)
  # After:
  m = re.match(r".+\(([^)]+)\)", h)
  ```
- `pip install -e ".[dev]"` 실행하여 의존성 확인
- 기존 테스트 전체 실행 (`pytest`)

#### 작업 1.2: 에이전트 팩토리 함수 도입

**파일:** `game_translator/agent.py`

현재 `agent.py`에서 `root_agent`를 모듈 레벨 변수로 생성한다. v3에서는 프로젝트의 source_type에 따라 다른 도구/스킬 세트를 가진 에이전트가 필요하다.

구현:
```python
def create_agent(source_type: str = "csv") -> Agent:
    """source_type에 따라 적절한 도구/스킬이 장착된 에이전트를 생성한다."""
    if source_type == "gws":
        from .skills.gws_sheets import create_gws_skill_toolset
        from .tools.pending import save_pending_translations
        from .tools.gws_read import gws_read_sheet
        tools = [
            get_project_config,
            get_sheet_context,
            get_glossary,
            get_style_guide,
            gws_read_sheet,              # Google Sheets 읽기 래퍼 도구
            save_pending_translations,    # 번역 결과 pending 저장
            create_gws_skill_toolset(),   # SkillToolset (gws CLI 참조 지시사항)
        ]
        instruction = ORCHESTRATOR_INSTRUCTION_GWS
    else:
        tools = [
            read_sheet, write_sheet,
            get_project_config, get_sheet_context,
            get_glossary, get_style_guide,
        ]
        instruction = ORCHESTRATOR_INSTRUCTION

    return Agent(
        model=_MODEL,
        name="game_translator",
        description="Game translation orchestrator.",
        instruction=instruction,
        tools=tools,
        sub_agents=[translator_agent, reviewer_agent],
    )

# ADK CLI 호환: 모듈 레벨 export 유지
root_agent = create_agent("csv")
```

- `game_translator/__init__.py` 변경: `from .agent import root_agent, create_agent` (기존 `root_agent` 유지 + `create_agent` 추가)
- `create_agent`을 export해야 `backend/main.py`에서 `from game_translator import create_agent`로 호출 가능

#### 작업 1.3: gws-sheets 스킬 디렉토리 구성

**파일:** `game_translator/skills/__init__.py`, `game_translator/skills/gws_sheets.py`

ADK 1.25.1의 SkillToolset API에 맞춰 gws-sheets 스킬을 프로그래밍 방식으로 구성한다. SKILL.md 파일 파싱이 아닌, `Skill` 객체를 직접 생성하는 방식이다.

`game_translator/skills/gws_sheets.py`:
```python
from google.adk.skills.models import Skill, Frontmatter, Resources, Script
from google.adk.tools.skill_toolset import SkillToolset

GWS_SHEETS_SKILL_MD = """
## Google Sheets Read Operations

You can read data from Google Sheets using the `gws` CLI tool.

### List tabs in a spreadsheet
```bash
gws sheets spreadsheets.get --spreadsheetId="{spreadsheet_id}" --fields="sheets.properties.title"
```

### Read tab data (all values)
```bash
gws sheets spreadsheets.values.get --spreadsheetId="{spreadsheet_id}" --range="{tab_name}"
```

### Read specific range
```bash
gws sheets spreadsheets.values.get --spreadsheetId="{spreadsheet_id}" --range="{tab_name}!A1:Z1000"
```

## Important Constraints
- You may ONLY READ from Google Sheets. Never write directly.
- After translating, call `save_pending_translations` to store results for user review.
- Never call `gws sheets spreadsheets.values.update` or `batchUpdate`.
"""

def create_gws_skill_toolset() -> SkillToolset:
    """Create a SkillToolset with gws-sheets read-only skill."""
    skill = Skill(
        frontmatter=Frontmatter(
            name="gws-sheets",
            description="Read data from Google Sheets using gws CLI. Read-only access.",
            allowed_tools="bash",
        ),
        instructions=GWS_SHEETS_SKILL_MD,
        resources=Resources(
            scripts={
                "read_tab": Script(
                    src='gws sheets spreadsheets.values.get --spreadsheetId="$1" --range="$2"'
                ),
            }
        ),
    )
    return SkillToolset(skills=[skill])
```

핵심 설계:
- `SkillToolset`은 에이전트에 `load_skill`, `load_skill_resource` 두 도구를 자동 제공
- Gemini가 `load_skill(name="gws-sheets")`을 호출하면 instructions(SKILL.md 내용)을 읽음
- 스킬 instructions에서 gws CLI 명령어를 안내하되, **쓰기 명령은 의도적으로 제외**
- `allowed_tools="bash"` 설정으로 에이전트가 bash를 통해 gws CLI를 실행할 수 있도록 힌트 제공
- 실제 gws CLI 실행은 에이전트의 `code_execution` 도구 또는 별도 `run_gws_command` 도구 함수를 통해 수행 (ADK Skills의 Script 실행 메커니즘 활용)

**대안 검토:** ADK Skills는 에이전트가 `load_skill`로 지시사항을 읽고 자율 실행하는 구조이므로, gws CLI 명령을 에이전트가 직접 subprocess로 실행하려면 `code_execution` 도구 또는 커스텀 `run_gws_read` 도구 함수가 필요하다. 안전을 위해 **읽기 전용 래퍼 도구 함수**를 추가로 제공한다:

```python
# game_translator/tools/gws_read.py
def gws_read_sheet(spreadsheet_id: str, tab_name: str) -> dict:
    """Read all data from a Google Sheets tab using gws CLI.
    
    Args:
        spreadsheet_id: The Google Sheets spreadsheet ID.
        tab_name: The tab/sheet name to read.
    
    Returns:
        Dict with 'headers', 'languages', 'rows' matching CSV read_sheet format.
        Returns error dict on failure.
    """
    # subprocess.run gws CLI, parse JSON output, convert to sheet format
```

이렇게 하면 에이전트가 `gws_read_sheet`을 직접 호출할 수 있고, SkillToolset의 SKILL.md는 이 도구의 사용법을 안내하는 참조 자료 역할을 한다.

#### 작업 1.4: gws 프로젝트용 번역 결과 저장 도구

**파일:** `game_translator/tools/pending.py` (새)

```python
"""Pending translations tool for gws projects. Saves to jobs.db."""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent.parent / "jobs.db"


def _ensure_table(conn: sqlite3.Connection) -> None:
    """Create the pending_translations table if it doesn't exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS pending_translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            sheet_name TEXT NOT NULL,
            key TEXT NOT NULL,
            lang_code TEXT NOT NULL,
            value TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'agent',
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            applied_at TEXT
        )
    """)
    # Partial unique index: only one pending entry per (project, sheet, key, lang_code).
    # Applied rows are excluded, so the same cell can have both a historical
    # applied row and a new pending row.
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_unique
        ON pending_translations(project_id, sheet_name, key, lang_code)
        WHERE status = 'pending'
    """)


def save_pending_translations(
    project_id: str,
    sheet_name: str,
    translations: list[dict],
) -> dict:
    """Save translation results to pending storage for user review.

    Each translation is a dict with keys: key, lang_code, value.
    These translations will NOT be written to Google Sheets directly.
    The user must review and apply them via the dashboard.

    Args:
        project_id: The project identifier.
        sheet_name: The sheet/tab name.
        translations: List of dicts with 'key', 'lang_code', 'value'.

    Returns:
        Dict with 'saved' count on success, or 'error' on failure.
    """
    if not translations:
        return {"saved": 0}

    now = datetime.now(timezone.utc).isoformat()
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        _ensure_table(conn)
        for t in translations:
            # Upsert: if a pending row exists for this cell, update its value.
            # Applied rows are unaffected thanks to the partial unique index.
            conn.execute("""
                INSERT INTO pending_translations
                (project_id, sheet_name, key, lang_code, value, source, status, created_at)
                VALUES (?, ?, ?, ?, ?, 'agent', 'pending', ?)
                ON CONFLICT(project_id, sheet_name, key, lang_code)
                WHERE status = 'pending'
                DO UPDATE SET value=excluded.value, source=excluded.source, created_at=excluded.created_at
            """, (project_id, sheet_name, t["key"], t["lang_code"], t["value"], now))
        conn.commit()
        return {"saved": len(translations)}
    except Exception as e:
        return {"error": str(e)}
    finally:
        conn.close()
```

**DB 경로 공유 메커니즘:**
- 에이전트 도구: `DB_PATH = Path(__file__).parent.parent.parent / "jobs.db"` (프로젝트 루트 기준)
- 백엔드 서비스: `self.db_path = "jobs.db"` (cwd 기준, uvicorn이 프로젝트 루트에서 실행)
- 두 경로가 동일한 `./jobs.db`를 가리킴 (기존 `JobHistoryService`의 패턴과 동일)

**SQLite 동시 접근 (sync + async):**
- 에이전트 도구는 동기 `sqlite3`를 사용 (ADK 도구 함수가 동기 호출)
- 백엔드 서비스는 비동기 `aiosqlite`를 사용
- 두 쪽 모두 접속 시 `PRAGMA journal_mode=WAL`을 설정하여 동시 읽기/쓰기 허용

**Upsert 전략 (partial unique index):**
- `UNIQUE INDEX ... WHERE status = 'pending'`은 pending 상태 행에만 유니크 제약을 건다
- `ON CONFLICT ... WHERE status = 'pending'`은 이 partial index와 매칭 (SQLite 3.35+, Python 3.11 번들)
- 동일 셀에 대해 applied 이력 행과 새 pending 행이 공존할 수 있다

#### 작업 1.5: 프롬프트 업데이트

**파일:** `game_translator/prompts.py`

```python
ORCHESTRATOR_INSTRUCTION_GWS = """You are the Orchestrator for a game translation system connected to Google Sheets.

## Your Responsibilities
1. Parse the user's request to determine the action: translate, update specific keys, or review.
2. Use tools to read Google Sheets data and load project configuration.
3. Translate text directly (do NOT delegate to sub-agents for translation).
4. Save translation results using save_pending_translations (NOT directly to Google Sheets).

## Workflow: Translate
1. Call get_project_config to get the project configuration (includes spreadsheet_id).
2. Call gws_read_sheet(spreadsheet_id, tab_name) to read the Google Sheets tab data.
3. Parse headers to detect languages. Headers follow pattern: "LanguageName(code)".
4. Call get_sheet_context for sheet-specific overrides.
5. Call get_glossary and get_style_guide for translation context.
6. For each target language, identify rows with empty cells.
7. Generate translations respecting glossary and style guide.
8. Call save_pending_translations(project_id, sheet_name, updates) with ALL translations.
   Each update is a dict with "key", "lang_code", and "value".

## CRITICAL RULES
- NEVER write directly to Google Sheets. Always use save_pending_translations.
- NEVER modify the source language column.
- ALWAYS call save_pending_translations after generating translations.
- Preserve ALL placeholders exactly as-is in translations.
"""
```

기존 `ORCHESTRATOR_INSTRUCTION` 유지 (CSV 프로젝트용). `TRANSLATOR_INSTRUCTION`과 `REVIEWER_INSTRUCTION`은 변경 없음.

**산출물:**
- ADK 1.25.1 호환 에이전트 패키지 (버전 핀 수정, locale 버그 수정)
- CSV/gws 에이전트 팩토리 (`create_agent`)
- gws SkillToolset + 읽기 전용 래퍼 도구
- pending 저장 에이전트 도구
- gws용 프롬프트
- 테스트: `tests/test_agent_factory.py` -- 에이전트 생성 검증, 도구 목록 확인, locale 파싱 수정 검증

---

### Stream 2: 백엔드 -- 프로젝트 source 타입 + GwsService + main.py 배선

**의존성:** 없음 (독립 시작 가능)
**담당 범위:** 프로젝트 모델 확장, gws 서비스, 시트 라우터 분기, main.py 배선

#### 작업 2.1: 프로젝트 모델에 source_type 추가

**파일:** `backend/models.py`, `backend/services/project_service.py`, `backend/routers/projects.py`

`backend/models.py` 변경:
```python
class SourceType(str, Enum):
    csv = "csv"
    gws = "gws"

class Project(_CamelModel):
    id: str
    name: str
    description: str
    source_type: SourceType = SourceType.csv
    spreadsheet_id: str | None = None
    sheet_count: int = 0
    last_translated_at: str | None = None
    created_at: str

class CreateProjectPayload(_CamelModel):
    name: str
    description: str
    source_type: SourceType = SourceType.csv
    spreadsheet_id: str | None = None
```

`backend/services/project_service.py` 변경:
- `create_project(name, description, source_type="csv", spreadsheet_id=None)`:
  - config.yaml에 `source: csv` 또는 `source: gws` + `spreadsheet_id` 저장
  - gws 프로젝트는 `sheets/` 디렉토리 생성 생략 (로컬 CSV 없음)
- `_load_project`:
  - `data.get("source", "csv")`로 source_type 읽기 (하위 호환: 키 없으면 csv)
  - `data.get("spreadsheet_id")` 읽기
- `_count_sheets`:
  - gws 프로젝트이면 0 반환 (CSV 파일 카운트 무의미). 실제 탭 수는 API 호출 시점에 GwsService에서 가져옴.

`backend/routers/projects.py` 변경:
- `create_project` 엔드포인트에서 `payload.source_type`, `payload.spreadsheet_id` 전달:
  ```python
  return service.create_project(
      payload.name, payload.description,
      source_type=payload.source_type.value,
      spreadsheet_id=payload.spreadsheet_id,
  )
  ```

#### 작업 2.2: GwsService 구현

**파일:** `backend/services/gws_service.py` (새)

```python
import asyncio
import json
import logging
from backend.models import SheetData, Language

import tempfile
import os

logger = logging.getLogger("gws_service")


def _col_to_a1(col_index: int) -> str:
    """Convert 0-based column index to A1 notation letters.
    0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, ... 701 -> ZZ
    """
    result = ""
    idx = col_index
    while True:
        result = chr(ord('A') + idx % 26) + result
        idx = idx // 26 - 1
        if idx < 0:
            break
    return result


class GwsError(Exception):
    """Base error for gws CLI operations."""
    pass

class GwsAuthError(GwsError):
    """gws CLI authentication error."""
    pass

class GwsTimeoutError(GwsError):
    """gws CLI timeout."""
    pass

class GwsParseError(GwsError):
    """Failed to parse gws CLI output."""
    pass

GWS_TIMEOUT = 30  # seconds

class GwsService:
    async def _run_gws(self, *args: str, stdin_data: str | None = None) -> dict:
        """Run a gws CLI command and return parsed JSON output.

        Raises GwsAuthError, GwsTimeoutError, GwsParseError, GwsError.
        """
        cmd = ["gws"] + list(args) + ["--format=json"]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE if stdin_data else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=stdin_data.encode("utf-8") if stdin_data else None),
                timeout=GWS_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise GwsTimeoutError(f"gws command timed out after {GWS_TIMEOUT}s: {' '.join(cmd)}")

        stderr_text = stderr.decode("utf-8", errors="replace").strip()
        
        if proc.returncode != 0:
            # Detect auth errors
            if any(kw in stderr_text.lower() for kw in ["unauthorized", "token expired", "invalid_grant", "auth"]):
                raise GwsAuthError(f"gws authentication error: {stderr_text}")
            raise GwsError(f"gws command failed (exit {proc.returncode}): {stderr_text}")

        stdout_text = stdout.decode("utf-8", errors="replace").strip()
        if not stdout_text:
            raise GwsParseError("gws returned empty output")
        
        try:
            return json.loads(stdout_text)
        except json.JSONDecodeError as e:
            raise GwsParseError(f"Failed to parse gws output as JSON: {e}\nOutput: {stdout_text[:500]}")

    async def check_auth(self) -> bool:
        """Check if gws CLI is authenticated. Returns True if auth is valid."""
        try:
            await self._run_gws("auth", "status")
            return True
        except (GwsError, FileNotFoundError):
            return False

    async def check_cli_installed(self) -> bool:
        """Check if gws CLI is installed and accessible."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "gws", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            return proc.returncode == 0
        except FileNotFoundError:
            return False

    async def list_tabs(self, spreadsheet_id: str) -> list[str]:
        """List tab names in a spreadsheet."""
        result = await self._run_gws(
            "sheets", "spreadsheets.get",
            f"--spreadsheetId={spreadsheet_id}",
            "--fields=sheets.properties.title",
        )
        sheets = result.get("sheets", [])
        return [s["properties"]["title"] for s in sheets if "properties" in s]

    async def read_tab(self, spreadsheet_id: str, tab_name: str) -> SheetData:
        """Read tab data and return as SheetData (same structure as CSV)."""
        import re
        result = await self._run_gws(
            "sheets", "spreadsheets.values.get",
            f"--spreadsheetId={spreadsheet_id}",
            f"--range={tab_name}",
        )
        values = result.get("values", [])
        if not values:
            return SheetData(sheet_name=tab_name, headers=["Key"], languages=[], rows=[])

        headers = values[0]
        raw_rows = values[1:]

        # Parse language headers (same logic as sheets_service.py)
        languages: list[Language] = []
        for h in headers[1:]:
            m = re.match(r"(.+)\(([^)]+)\)", h)
            if m:
                languages.append(Language(code=m.group(2), label=m.group(1), is_source=False))
        if languages:
            languages[0].is_source = True

        rows = []
        for raw_row in raw_rows:
            row = {"key": raw_row[0] if raw_row else ""}
            for i, lang in enumerate(languages):
                row[lang.code] = raw_row[i + 1] if i + 1 < len(raw_row) else ""
            rows.append(row)

        return SheetData(sheet_name=tab_name, headers=headers, languages=languages, rows=rows)

    async def batch_update(
        self, spreadsheet_id: str, tab_name: str, updates: list[dict]
    ) -> int:
        """Write translation results to Google Sheets.
        
        Each update dict has: key, lang_code, value, row_index, col_index.
        Uses batchUpdate for atomicity.
        
        Returns number of updated cells.
        Raises GwsError on failure (no partial writes).
        """
        if not updates:
            return 0
        
        data = []
        for u in updates:
            col_letter = _col_to_a1(u["col_index"])
            cell_ref = f"{tab_name}!{col_letter}{u['row_index'] + 2}"  # +2 for 1-indexed + header
            data.append({"range": cell_ref, "values": [[u["value"]]]})

        payload = {
            "valueInputOption": "RAW",
            "data": data,
        }

        # Write payload to temp file to avoid shell escaping issues
        # with JSON special characters in subprocess args.
        fd, tmp_path = tempfile.mkstemp(suffix=".json", prefix="gws_batch_")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)

            result = await self._run_gws(
                "sheets", "spreadsheets.values.batchUpdate",
                f"--spreadsheetId={spreadsheet_id}",
                f"--request.body=@{tmp_path}",
            )
        finally:
            os.unlink(tmp_path)

        return result.get("totalUpdatedCells", len(updates))
```

`backend/routers/gws.py` (새):
```python
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/gws", tags=["gws"])

@router.get("/auth-status")
async def gws_auth_status(request: Request):
    gws_svc = request.app.state.gws_service
    cli_installed = await gws_svc.check_cli_installed()
    if not cli_installed:
        return {"authenticated": False, "cliInstalled": False, "message": "gws CLI not installed"}
    authenticated = await gws_svc.check_auth()
    return {"authenticated": authenticated, "cliInstalled": True}
```

#### 작업 2.3: main.py 배선 (서비스 초기화 + 라우터 등록)

**파일:** `backend/main.py`

이 작업은 Stream 2~3의 모든 새 서비스와 라우터를 `main.py`에 등록한다. 다른 스트림에서 서비스/라우터를 만들지만, main.py 등록은 이 작업에서 일괄 처리한다.

lifespan에 추가:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    from backend.services.sheets_service import SheetsService
    from backend.services.job_service import JobService
    from backend.services.config_service import ConfigService
    from backend.services.gws_service import GwsService
    from backend.services.pending_translations_service import PendingTranslationsService

    app.state.sheets_service = SheetsService()
    app.state.job_service = JobService()
    app.state.config_service = ConfigService()
    app.state.gws_service = GwsService()

    from backend.services.job_history_service import JobHistoryService
    job_history_service = JobHistoryService()
    await job_history_service.init_db()
    app.state.job_history_service = job_history_service

    pending_svc = PendingTranslationsService()
    await pending_svc.init_db()
    app.state.pending_translations_service = pending_svc

    # gws CLI startup validation (non-blocking, log only)
    try:
        gws_ok = await app.state.gws_service.check_cli_installed()
        if gws_ok:
            auth_ok = await app.state.gws_service.check_auth()
            if not auth_ok:
                print("[WARN] gws CLI installed but not authenticated. Run 'gws auth login --scopes sheets'.")
        else:
            print("[INFO] gws CLI not installed. Google Sheets projects will not work.")
    except Exception as e:
        print(f"[WARN] gws CLI check failed: {e}")

    # ADK Runner (CSV default)
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
```

라우터 등록에 추가:
```python
from backend.routers import projects, config, sheets, jobs, job_history, ws, languages, gws, translations

# ... 기존 라우터 ...
app.include_router(gws.router)
app.include_router(translations.router)
```

#### 작업 2.4: 시트 라우터에서 source_type 분기

**파일:** `backend/routers/sheets.py`

각 엔드포인트에 source_type 분기 추가. 공통 헬퍼 함수:
```python
def _get_project_source(request: Request, project_id: str) -> tuple[str, str | None]:
    """Return (source_type, spreadsheet_id) for a project."""
    config_svc = request.app.state.config_service
    cfg = config_svc._read_config(project_id)
    return cfg.get("source", "csv"), cfg.get("spreadsheet_id")
```

분기 규칙:
- `list_sheets`: gws -> `await gws_service.list_tabs(spreadsheet_id)`, csv -> 기존
- `get_sheet_data`: gws -> `await gws_service.read_tab(spreadsheet_id, sheet_name)`, csv -> 기존
- `create_sheet`, `delete_sheet`: gws -> 403 ("Sheet management is controlled by Google Sheets"), csv -> 기존
- `update_rows`: gws -> `pending_svc.save_translations(project_id, sheet_name, updates, source="user_edit")`, csv -> 기존 즉시 쓰기
- `add_row`, `delete_rows`: gws -> 403 ("Row management is controlled by Google Sheets"), csv -> 기존
- `export`: gws -> `gws_service.read_tab` 후 CSV 포맷으로 변환, csv -> 기존
- `upload_csv`: gws -> 403 ("CSV upload not available for Google Sheets projects"), csv -> 기존

#### 작업 2.5: sheet_count gws 분기

**파일:** `backend/services/project_service.py`

```python
def _count_sheets(self, project_id: str) -> int:
    cfg_path = self.projects_dir / project_id / "config.yaml"
    if cfg_path.exists():
        with open(cfg_path) as f:
            cfg = yaml.safe_load(f) or {}
        if cfg.get("source") == "gws":
            return 0  # gws 프로젝트는 API 호출 시점에 탭 수를 가져옴
    sheets_dir = self.projects_dir / project_id / "sheets"
    if not sheets_dir.exists():
        return 0
    return len(list(sheets_dir.glob("*.csv")))
```

참고: gws 프로젝트의 `sheet_count`는 프로젝트 목록 API에서 0으로 표시된다. 정확한 탭 수가 필요하면 `list_sheets` API를 호출해야 한다. 이는 프로젝트 목록 화면에서 gws 프로젝트 카드에 "Google Sheets" 뱃지를 표시하고, 시트 수 대신 소스 타입을 강조하는 방식으로 해결한다.

**gws CLI 모킹 전략 (테스트):**

`tests/conftest.py`에 `MockGwsRunner` fixture 제공:
```python
@pytest.fixture
def mock_gws_service(monkeypatch):
    """GwsService의 _run_gws를 mock하여 subprocess 실행 없이 테스트."""
    responses = {}  # command pattern -> response dict
    
    async def mock_run_gws(self, *args):
        key = " ".join(args)
        for pattern, response in responses.items():
            if pattern in key:
                return response
        raise GwsError(f"No mock response for: {key}")
    
    monkeypatch.setattr(GwsService, "_run_gws", mock_run_gws)
    return responses  # 테스트에서 responses를 채워서 사용
```

**산출물:**
- source_type 지원 프로젝트 CRUD (API 응답에 sourceType/spreadsheetId 포함)
- GwsService (에러 처리 포함: timeout, auth, parse)
- gws 인증 상태 API
- main.py 배선 (모든 새 서비스 + 라우터 등록)
- 시트 API source_type 분기
- gws 프로젝트 sheet_count 처리
- 서버 부트 시 gws CLI 유효성 체크
- 테스트: `tests/test_project_source_type.py`, `tests/test_gws_service.py` (mock 기반)

---

### Stream 3: 백엔드 -- Pending Translations + Apply 워크플로우

**의존성:** Stream 2 (source_type 분기, GwsService, main.py 배선 필요)
**담당 범위:** SQLite pending 저장, Apply API, job 실행 분기, write detection 수정

#### 작업 3.1: PendingTranslationsService 구현

**파일:** `backend/services/pending_translations_service.py` (새)

```python
import aiosqlite
from datetime import datetime, timezone


class PendingTranslationsService:
    def __init__(self, db_path: str = "jobs.db"):
        self.db_path = db_path  # jobs.db와 동일 파일, job_history 테이블과 공존

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            # Enable WAL mode for concurrent sync (agent tool) + async (this service) access
            await db.execute("PRAGMA journal_mode=WAL")
            await db.execute("""
                CREATE TABLE IF NOT EXISTS pending_translations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id TEXT NOT NULL,
                    sheet_name TEXT NOT NULL,
                    key TEXT NOT NULL,
                    lang_code TEXT NOT NULL,
                    value TEXT NOT NULL,
                    source TEXT NOT NULL DEFAULT 'agent',
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    applied_at TEXT
                )
            """)
            # Unique constraint: one pending entry per (project, sheet, key, lang)
            await db.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_unique
                ON pending_translations(project_id, sheet_name, key, lang_code)
                WHERE status = 'pending'
            """)
            await db.commit()

    async def save_translations(
        self, project_id: str, sheet_name: str,
        translations: list[dict], source: str = "agent",
    ) -> int:
        """Save or upsert pending translations. Returns saved count."""
        now = datetime.now(timezone.utc).isoformat()
        saved = 0
        async with aiosqlite.connect(self.db_path) as db:
            for t in translations:
                # Upsert against the partial unique index on pending rows.
                cursor = await db.execute("""
                    INSERT INTO pending_translations
                    (project_id, sheet_name, key, lang_code, value, source, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
                    ON CONFLICT(project_id, sheet_name, key, lang_code)
                    WHERE status = 'pending'
                    DO UPDATE SET value=excluded.value, source=excluded.source, created_at=excluded.created_at
                """, (project_id, sheet_name, t["key"], t["lang_code"], t["value"], source, now))
                if cursor.rowcount > 0:
                    saved += 1
            await db.commit()
            return saved

    async def get_pending(self, project_id: str, sheet_name: str) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT * FROM pending_translations
                WHERE project_id = ? AND sheet_name = ? AND status = 'pending'
                ORDER BY created_at
            """, (project_id, sheet_name))
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def get_pending_count(self, project_id: str, sheet_name: str) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                SELECT COUNT(*) FROM pending_translations
                WHERE project_id = ? AND sheet_name = ? AND status = 'pending'
            """, (project_id, sheet_name))
            row = await cursor.fetchone()
            return row[0] if row else 0

    async def mark_applied(self, project_id: str, sheet_name: str) -> int:
        now = datetime.now(timezone.utc).isoformat()
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                UPDATE pending_translations
                SET status = 'applied', applied_at = ?
                WHERE project_id = ? AND sheet_name = ? AND status = 'pending'
            """, (now, project_id, sheet_name))
            await db.commit()
            return cursor.rowcount

    async def discard_pending(self, project_id: str, sheet_name: str) -> int:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                DELETE FROM pending_translations
                WHERE project_id = ? AND sheet_name = ? AND status = 'pending'
            """, (project_id, sheet_name))
            await db.commit()
            return cursor.rowcount
```

#### 작업 3.2: Apply API 엔드포인트

**파일:** `backend/routers/translations.py` (새)

```python
import re
from fastapi import APIRouter, HTTPException, Request
from backend.services.gws_service import GwsError, GwsAuthError

router = APIRouter(prefix="/api/projects/{project_id}", tags=["translations"])


@router.get("/sheets/{sheet_name}/pending")
async def get_pending_translations(project_id: str, sheet_name: str, request: Request):
    pending_svc = request.app.state.pending_translations_service
    items = await pending_svc.get_pending(project_id, sheet_name)
    return {"items": items, "count": len(items)}


@router.get("/sheets/{sheet_name}/pending/count")
async def get_pending_count(project_id: str, sheet_name: str, request: Request):
    pending_svc = request.app.state.pending_translations_service
    count = await pending_svc.get_pending_count(project_id, sheet_name)
    return {"count": count}


@router.post("/sheets/{sheet_name}/apply")
async def apply_translations(project_id: str, sheet_name: str, request: Request):
    """Apply pending translations to Google Sheets."""
    config_svc = request.app.state.config_service
    cfg = config_svc._read_config(project_id)
    source = cfg.get("source", "csv")
    spreadsheet_id = cfg.get("spreadsheet_id")

    if source != "gws":
        raise HTTPException(400, "Apply is only available for Google Sheets projects")
    if not spreadsheet_id:
        raise HTTPException(400, "Project has no spreadsheet_id configured")

    pending_svc = request.app.state.pending_translations_service
    gws_svc = request.app.state.gws_service

    items = await pending_svc.get_pending(project_id, sheet_name)
    if not items:
        return {"applied": 0, "message": "No pending translations"}

    # Read current sheet to build cell position map
    sheet_data = await gws_svc.read_tab(spreadsheet_id, sheet_name)
    
    # Build key -> row_index and lang_code -> col_index maps
    key_index = {row["key"]: i for i, row in enumerate(sheet_data.rows)}
    col_index = {}
    for i, h in enumerate(sheet_data.headers[1:], start=1):
        m = re.match(r".+\(([^)]+)\)", h)
        if m:
            col_index[m.group(1)] = i

    # Convert pending items to positional updates
    updates = []
    skipped = 0
    for item in items:
        row_idx = key_index.get(item["key"])
        col_idx = col_index.get(item["lang_code"])
        if row_idx is not None and col_idx is not None:
            updates.append({
                "key": item["key"],
                "lang_code": item["lang_code"],
                "value": item["value"],
                "row_index": row_idx,
                "col_index": col_idx,
            })
        else:
            skipped += 1

    if not updates:
        return {"applied": 0, "skipped": skipped, "message": "No matching cells found"}

    try:
        updated = await gws_svc.batch_update(spreadsheet_id, sheet_name, updates)
    except GwsAuthError as e:
        raise HTTPException(401, f"Google Sheets authentication error: {e}")
    except GwsError as e:
        raise HTTPException(502, f"Google Sheets update failed: {e}")

    # Mark as applied only after successful write
    await pending_svc.mark_applied(project_id, sheet_name)

    return {"applied": updated, "skipped": skipped}


@router.delete("/sheets/{sheet_name}/pending")
async def discard_pending(project_id: str, sheet_name: str, request: Request):
    pending_svc = request.app.state.pending_translations_service
    discarded = await pending_svc.discard_pending(project_id, sheet_name)
    return {"discarded": discarded}
```

#### 작업 3.3: job 실행 로직 분기 + write detection 수정

**파일:** `backend/routers/jobs.py`

이 작업은 세 가지를 수정한다:
1. `create_job`에서 gws 프로젝트일 때 total_keys를 GwsService에서 가져오기
2. `run_agent_job`에서 source_type에 따라 Runner를 동적 생성
3. `_run_agent_turn`의 write detection을 일반화

**3.3a: `_run_agent_turn` write detection 수정**

현재 76행의 `part.function_call.name == "write_sheet"` 하드코딩을 일반화한다:

```python
# Before:
async def _run_agent_turn(runner, session_id, user_id, message):
    # ...
    if part.function_call.name == "write_sheet":
        wrote_sheet = True

# After:
WRITE_TOOL_NAMES = {"write_sheet", "save_pending_translations"}

async def _run_agent_turn(runner, session_id, user_id, message):
    """Run one agent turn and return (response_text, called_write_tool, event_count)."""
    from google.genai import types

    content = types.Content(
        role="user",
        parts=[types.Part(text=message)],
    )

    response_text = ""
    called_write_tool = False
    event_count = 0

    async for event in runner.run_async(
        session_id=session_id,
        user_id=user_id,
        new_message=content,
    ):
        event_count += 1
        if getattr(event, "content", None) and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    if part.function_call.name in WRITE_TOOL_NAMES:
                        called_write_tool = True
                elif hasattr(part, "text") and part.text:
                    response_text += part.text

    return response_text, called_write_tool, event_count
```

**3.3b: `create_job`에서 gws 프로젝트 total_keys**

```python
@router.post("...", response_model=TranslationJob, status_code=201)
async def create_job(project_id, sheet_name, payload, background_tasks, request):
    job_svc = request.app.state.job_service
    config_svc = request.app.state.config_service
    cfg = config_svc._read_config(project_id)
    source = cfg.get("source", "csv")

    total_keys = 0
    if source == "gws":
        spreadsheet_id = cfg.get("spreadsheet_id")
        if spreadsheet_id:
            try:
                gws_svc = request.app.state.gws_service
                sheet_data = await gws_svc.read_tab(spreadsheet_id, sheet_name)
                total_keys = len(sheet_data.rows)
            except Exception:
                pass  # Will be 0; agent will determine actual count
    else:
        sheets_svc = request.app.state.sheets_service
        sheet_data = sheets_svc.get_sheet_data(project_id, sheet_name)
        if sheet_data:
            total_keys = len(sheet_data.rows)

    job = job_svc.create_job(project_id, sheet_name, payload.type.value, total_keys=total_keys)
    background_tasks.add_task(run_agent_job, request.app, job.job_id)
    return job
```

**3.3c: `run_agent_job`에서 Runner 동적 생성**

```python
async def run_agent_job(app, job_id: str):
    job_svc = app.state.job_service
    job = job_svc.get_job(job_id)
    if not job:
        return

    # Determine source type
    config_svc = app.state.config_service
    cfg = config_svc._read_config(job.project_id)
    source_type = cfg.get("source", "csv")

    job_svc.update_job(job_id, status=JobStatus.running, progress=10)
    await broadcast_job_update(job_id, {...})

    try:
        session_service = app.state.session_service
        if not session_service:
            raise RuntimeError("ADK SessionService not initialized")

        # Create appropriate runner based on source type
        if source_type == "gws":
            from game_translator.agent import create_agent
            from google.adk.runners import Runner
            gws_agent = create_agent("gws")
            runner = Runner(
                agent=gws_agent,
                session_service=session_service,
                app_name="game_translator",
            )
        else:
            runner = app.state.runner
            if not runner:
                raise RuntimeError("ADK Runner not initialized")

        session = await session_service.create_session(
            app_name="game_translator",
            user_id=job.project_id,
        )

        # Build user message
        if source_type == "gws":
            spreadsheet_id = cfg.get("spreadsheet_id", "")
            if job.type.value == "translate_all":
                user_msg = (
                    f"Translate the '{job.sheet_name}' tab in Google Sheets "
                    f"(spreadsheet ID: {spreadsheet_id}) for the '{job.project_id}' project. "
                    f"Translate all keys to all target languages. "
                    f"You MUST call save_pending_translations to save results."
                )
            # ... similar for update/review
        else:
            # Existing CSV messages
            if job.type.value == "translate_all":
                user_msg = f"Translate the {job.sheet_name} sheet for the {job.project_id} project. ..."

        # ... run agent turns ...

        # Turn 2 nudge: source_type-aware
        if not called_write_tool and job.type.value in ("translate_all", "update"):
            if source_type == "gws":
                followup = (
                    "You have the translations ready. Now call "
                    "save_pending_translations(project_id, sheet_name, translations) "
                    "to save them for user review. Each translation needs 'key', 'lang_code', 'value'."
                )
            else:
                followup = (
                    "You have the translations ready. Now call "
                    "write_sheet(project_id, sheet_name, updates) to save them. ..."
                )
            # ... second turn ...
```

**산출물:**
- PendingTranslationsService (jobs.db 공유)
- Apply API (낙관적 덮어쓰기, GwsError 전파)
- Pending CRUD API (조회, 개수, 폐기)
- job 실행 source_type 분기 (Runner 동적 생성)
- write detection 일반화 (`WRITE_TOOL_NAMES` set)
- Turn 2 nudge 메시지 source_type 대응
- 테스트: `tests/test_pending_translations.py`, `tests/test_apply_workflow.py`

---

### Stream 4: 프론트엔드 -- 프로젝트 소스 타입 + Apply UI

**의존성:** Stream 2 완료 (백엔드 API 필요). 타입/UI 선행 작업은 Stream 2 모델 정의만 확인하면 가능.
**담당 범위:** 프론트엔드 전체 변경

**Stream 4 병렬 개발을 위한 최소 백엔드 API 계약:**

| Endpoint | Method | Request | Response |
|---|---|---|---|
| `/api/projects` | POST | `{ name, description, sourceType?, spreadsheetId? }` | `Project` |
| `/api/projects/{id}` | GET | - | `Project` (includes `sourceType`, `spreadsheetId`) |
| `/api/gws/auth-status` | GET | - | `{ authenticated: bool, cliInstalled: bool }` |
| `/api/projects/{id}/sheets/{name}/pending` | GET | - | `{ items: PendingTranslation[], count: number }` |
| `/api/projects/{id}/sheets/{name}/pending/count` | GET | - | `{ count: number }` |
| `/api/projects/{id}/sheets/{name}/apply` | POST | - | `{ applied: number, skipped: number }` |
| `/api/projects/{id}/sheets/{name}/pending` | DELETE | - | `{ discarded: number }` |

#### 작업 4.1: 타입 + API 클라이언트 확장

**파일:** `frontend/src/types/project.ts`, `frontend/src/types/translation.ts`, `frontend/src/api/sheets.ts`, `frontend/src/api/gws.ts` (새)

`frontend/src/types/project.ts`:
```typescript
export type SourceType = 'csv' | 'gws'

export interface Project {
  id: string
  name: string
  description: string
  sourceType: SourceType
  spreadsheetId: string | null
  sheetCount: number
  lastTranslatedAt: string | null
  createdAt: string
}

export interface CreateProjectPayload {
  name: string
  description: string
  sourceType?: SourceType
  spreadsheetId?: string
}
```

`frontend/src/types/translation.ts`에 추가:
```typescript
export interface PendingTranslation {
  id: number
  projectId: string
  sheetName: string
  key: string
  langCode: string
  value: string
  source: 'agent' | 'user_edit'
  createdAt: string
}

export interface PendingTranslationsResponse {
  items: PendingTranslation[]
  count: number
}
```

`frontend/src/api/sheets.ts`에 추가:
```typescript
export function fetchPendingTranslations(projectId: string, sheetName: string) {
  return api<PendingTranslationsResponse>(
    'GET',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/pending`,
  )
}

export function fetchPendingCount(projectId: string, sheetName: string) {
  return api<{ count: number }>(
    'GET',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/pending/count`,
  )
}

export function applyTranslations(projectId: string, sheetName: string) {
  return api<{ applied: number; skipped: number }>(
    'POST',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/apply`,
  )
}

export function discardPending(projectId: string, sheetName: string) {
  return api<{ discarded: number }>(
    'DELETE',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/pending`,
  )
}
```

`frontend/src/api/gws.ts` (새):
```typescript
import { api } from './client'

export function checkGwsAuth() {
  return api<{ authenticated: boolean; cliInstalled: boolean; message?: string }>(
    'GET', '/api/gws/auth-status',
  )
}
```

`frontend/src/lib/constants.ts`에 query key 추가:
```typescript
pendingTranslations: (projectId: string, sheetName: string) =>
  ['pendingTranslations', projectId, sheetName] as const,
pendingCount: (projectId: string, sheetName: string) =>
  ['pendingCount', projectId, sheetName] as const,
```

#### 작업 4.2: CreateProjectModal 소스 타입 선택

**파일:** `frontend/src/components/CreateProjectModal.tsx`

변경 내용:
- `sourceType` 상태 추가 (기본값 `'csv'`)
- `spreadsheetId` 상태 추가
- 폼에 라디오 버튼 그룹 추가: "Local CSV" / "Google Sheets"
- "Google Sheets" 선택 시:
  - `spreadsheetId` 입력 필드 표시 (필수)
  - `useQuery`로 `checkGwsAuth()` 호출하여 인증 상태 확인
  - 미인증 시 경고 배너: "gws CLI is not authenticated. Run `gws auth login --scopes sheets` on the server."
  - CLI 미설치 시: "gws CLI is not installed on the server."
- `mutation.mutate({ name, description, sourceType, spreadsheetId })` 전달
- `useCreateProject` 훅에서 새 필드 전달하도록 수정

#### 작업 4.3: usePendingTranslations 훅

**파일:** `frontend/src/hooks/usePendingTranslations.ts` (새)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchPendingCount, fetchPendingTranslations, applyTranslations, discardPending } from '../api/sheets'
import { QUERY_KEYS } from '../lib/constants'

export function usePendingCount(projectId: string, sheetName: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.pendingCount(projectId, sheetName),
    queryFn: () => fetchPendingCount(projectId, sheetName),
    enabled,
  })
}

export function usePendingTranslations(projectId: string, sheetName: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName),
    queryFn: () => fetchPendingTranslations(projectId, sheetName),
    enabled,
  })
}

export function useApplyTranslations(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => applyTranslations(projectId, sheetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingCount(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName) })
    },
  })
}

export function useDiscardPending(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => discardPending(projectId, sheetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingCount(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName) })
    },
  })
}
```

#### 작업 4.4: ApplyBar 컴포넌트

**파일:** `frontend/src/components/ApplyBar.tsx` (새)

```typescript
interface ApplyBarProps {
  pendingCount: number
  onApply: () => void
  onDiscard: () => void
  isApplying: boolean
  applyError?: string
}

export function ApplyBar({ pendingCount, onApply, onDiscard, isApplying, applyError }: ApplyBarProps) {
  if (pendingCount === 0) return null
  
  return (
    <div className="sticky bottom-0 border-t border-border bg-amber-50 px-4 py-3 flex items-center justify-between">
      <span className="text-sm text-amber-800">
        {pendingCount} pending change{pendingCount !== 1 ? 's' : ''}
      </span>
      {applyError && (
        <span className="text-sm text-red-600 mx-4">{applyError}</span>
      )}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={isApplying}>
          Discard
        </Button>
        <Button size="sm" onClick={onApply} disabled={isApplying}>
          {isApplying ? 'Applying...' : 'Apply to Google Sheets'}
        </Button>
      </div>
    </div>
  )
}
```

#### 작업 4.5: SheetViewer gws 프로젝트 대응

**파일:** `frontend/src/pages/SheetViewer.tsx`

이 작업은 네 가지 하위 항목으로 분해한다:

**4.5a: 프로젝트 sourceType 감지**

SheetViewer에서 프로젝트의 sourceType을 알아야 한다. `fetchProject` API를 사용:
```typescript
const { data: project } = useQuery({
  queryKey: QUERY_KEYS.project(projectId!),
  queryFn: () => fetchProject(projectId!),
})
const isGws = project?.sourceType === 'gws'
```

**4.5b: gws 프로젝트 셀 편집 -> pending 저장**

```typescript
const handleCellSave = (key: string, langCode: string, value: string) => {
  if (isGws) {
    // gws: save to pending via API, then invalidate pending count
    savePendingMutation.mutate([{ key, langCode, value }], {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingCount(projectId!, sheetName!) })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingTranslations(projectId!, sheetName!) })
      },
    })
  } else {
    // csv: immediate save (existing behavior)
    saveMutation.mutate([{ key, langCode, value }])
  }
}
```

gws 프로젝트에서 `updateSheetRows` API는 Stream 2 작업 2.4에서 pending으로 리다이렉트하므로, 실제로는 기존 `saveMutation`을 그대로 사용해도 된다. 단, UI에서 pending 상태를 시각적으로 표시해야 한다.

**4.5c: pending 번역 클라이언트 사이드 머지 + diff 표시**

gws 프로젝트에서 SheetViewer는 두 가지 데이터를 조합하여 렌더링한다:
1. **Base data**: `useSheetData` -> GwsService가 Google Sheets에서 읽은 현재 데이터 (변경 전 원본)
2. **Pending data**: `usePendingTranslations` -> SQLite에 저장된 미적용 변경사항

클라이언트 사이드 머지 전략:

```typescript
// 1. pending 데이터를 key+langCode 기준 lookup map으로 변환
const pendingOverrides = useMemo(() => {
  if (!isGws || !pendingData?.items) return undefined
  const overrides: Record<string, Record<string, string>> = {}
  for (const item of pendingData.items) {
    if (!overrides[item.key]) overrides[item.key] = {}
    overrides[item.key][item.langCode] = item.value
  }
  return overrides
}, [isGws, pendingData])

// 2. 머지된 rows 생성: base data + pending overrides
// pending 값이 있는 셀은 pending 값으로 교체
const mergedRows = useMemo(() => {
  if (!data || !pendingOverrides) return data?.rows ?? []
  return data.rows.map(row => {
    const overrides = pendingOverrides[row.key]
    if (!overrides) return row
    return { ...row, ...overrides }
  })
}, [data, pendingOverrides])

// 3. base data 원본 보존 (diff 비교용)
const baseRows = data?.rows  // Google Sheets 원본 (pending 미반영)
```

DataTable 컴포넌트에 두 가지 prop 추가:
- `rows`: `mergedRows` (pending 값이 반영된 머지 데이터)
- `pendingCells?: Record<string, Record<string, string>>`: 하이라이트할 셀 식별용

DataTable 셀 렌더링 로직:
- `pendingCells[key][langCode]`가 존재하면:
  - 노란색 배경 하이라이트 (`bg-amber-50 border-amber-200`)
  - base data에 원래 값이 있었으면: 작은 텍스트로 원본 표시 (취소선) + 현재 표시 값은 pending 값
  - base data가 비어 있었으면 (새 번역): 초록색 배경 (`bg-green-50`) + "NEW" 뱃지
- `pendingCells`에 없는 셀: 기존 스타일 그대로

- 하단에 ApplyBar 렌더링:
```typescript
{isGws && (
  <ApplyBar
    pendingCount={pendingCount?.count ?? 0}
    onApply={() => applyMutation.mutate()}
    onDiscard={() => discardMutation.mutate()}
    isApplying={applyMutation.isPending}
    applyError={applyMutation.isError ? applyMutation.error.message : undefined}
  />
)}
```

**4.5d: gws 프로젝트 기능 제한**

- gws 프로젝트에서 비활성화할 UI 요소:
  - "Upload CSV" 버튼 숨김
  - "Add Row" 비활성화 (시트 구조는 Google Sheets 마스터)

- csv 프로젝트에서는 pending 관련 UI 전부 숨김 (기존 동작 유지)

#### 작업 4.6: Sidebar gws 프로젝트 대응

**파일:** `frontend/src/components/layout/Sidebar.tsx`

```typescript
// ProjectLayout에서 project 데이터를 context로 제공하거나, Sidebar에서 직접 조회
const { data: project } = useQuery({
  queryKey: QUERY_KEYS.project(projectId!),
  queryFn: () => fetchProject(projectId!),
})
const isGws = project?.sourceType === 'gws'
```

변경:
- gws 프로젝트이면 시트 추가 "+" 버튼 숨김
- gws 프로젝트이면 시트 삭제 "x" 버튼 숨김
- 시트 목록 항목에 호버 시 삭제 아이콘 대신 "Google Sheets" 작은 아이콘 표시 (선택적)

#### 작업 4.7: ProjectCard에 소스 타입 뱃지

**파일:** `frontend/src/components/ProjectCard.tsx`

- gws 프로젝트 카드에 "Google Sheets" 뱃지 표시
- sheet_count가 0인 gws 프로젝트에서 "0 sheets" 대신 "Google Sheets" 표시

**산출물:**
- 타입 정의 + API 클라이언트 (sourceType, pending CRUD, gws auth check)
- CreateProjectModal 소스 타입 선택 (인증 상태 확인 포함)
- usePendingTranslations 훅 (count, list, apply, discard)
- ApplyBar 컴포넌트
- SheetViewer gws 대응 (pending 셀 하이라이트, diff 오버레이, Apply 바)
- Sidebar gws 대응 (추가/삭제 버튼 숨김)
- ProjectCard 소스 타입 뱃지

---

### Stream 5: 통합 + 마무리

**의존성:** Stream 1, 2, 3, 4 모두 완료
**담당 범위:** 통합 테스트, 엣지 케이스 처리, 문서 업데이트

#### 작업 5.1: 통합 테스트

gws 프로젝트 E2E:
1. gws 인증 상태 확인 (`GET /api/gws/auth-status`)
2. gws 프로젝트 생성 (`POST /api/projects` with `sourceType: "gws"`)
3. 시트 목록 조회 (Google Sheets 탭)
4. 시트 데이터 읽기 (Google Sheets 데이터)
5. 번역 job 트리거 (`POST .../jobs`)
6. job 완료 후 pending 확인 (`GET .../pending`)
7. pending 번역 diff 확인 (프론트엔드)
8. Apply 실행 (`POST .../apply`)
9. Google Sheets 반영 확인

csv 프로젝트 회귀 테스트:
1. 기존 프로젝트 (config.yaml에 `source` 키 없음) 정상 동작 확인
2. 시트 CRUD, 행 CRUD, 셀 편집 즉시 저장
3. 번역 job -> CSV 직접 쓰기
4. CSV 업로드 머지

#### 작업 5.2: 기존 프로젝트 하위 호환 검증

- `projects/opal_app/config.yaml`: `source` 키 없음 -> `csv`로 취급 확인
- `projects/merge_dog/config.yaml`: 동일
- 프론트엔드에서 기존 프로젝트 카드에 `sourceType: "csv"` 표시 확인
- 시트 추가/삭제, 행 추가/삭제, 셀 편집, 언어 관리 모든 기존 기능 정상 동작

#### 작업 5.3: 에러 시나리오 테스트

- gws CLI 미설치 상태에서 gws 프로젝트 생성 시도 -> 경고 표시
- gws 인증 만료 후 Apply 시도 -> 401 에러, 재인증 안내
- Google Sheets 접근 권한 없는 spreadsheet_id -> 적절한 에러 메시지
- 번역 job 실행 중 서버 재시작 -> pending 데이터 유지 확인 (SQLite 영속)
- Apply 실패 후 pending 데이터 유지 확인 -> 재시도 가능

#### 작업 5.4: 문서 업데이트

- `CLAUDE.md`:
  - Project Structure에 `game_translator/skills/`, `game_translator/tools/pending.py` 추가
  - Commands에 `gws auth login --scopes sheets` 추가
  - Gotchas에 "gws 프로젝트에서 번역 결과는 Apply 경유 필수" 추가
  - Design Docs 테이블에 `gws-integration.md` 참조 시점 추가

- `README.md`:
  - "Google Sheets Integration" 섹션 추가: 설정 방법, gws CLI 설치, 인증

- `docs/feature/gws-integration.md`:
  - 구현 후 실제 API 경로, 에이전트 구조 반영

---

## 작업 의존성 그래프

```
Stream 1 (에이전트: Skills + 팩토리)  ──────────────────┐
                                                         │
Stream 2 (백엔드: source_type + GwsService + main.py) ─┬─┤
                                                        │ │
Stream 3 (백엔드: Pending + Apply)  ◄───────────────────┘ ├──→ Stream 5 (통합)
                                                          │
Stream 4 (프론트엔드: 소스타입 + Apply UI)  ◄─ Stream 2 ─┘
```

**병렬 실행 가능 조합:**
- **Stream 1 + Stream 2**: 완전 독립. 동시 시작 가능.
- **Stream 4 작업 4.1~4.2**: Stream 2의 모델 정의만 확인하면 타입/UI 선행 작업 가능.
- **Stream 3**: Stream 2 완료 후 시작 (source_type 분기, GwsService, main.py 배선 의존).
- **Stream 4 작업 4.3~4.7**: Stream 3의 pending API 정의 필요. 타입 인터페이스만 합의하면 병렬 진행 가능.

**권장 실행 순서:**
1. **Phase A** (병렬): Stream 1 전체 + Stream 2 전체 + Stream 4 작업 4.1~4.2
2. **Phase B** (병렬): Stream 3 전체 + Stream 4 작업 4.3~4.7
3. **Phase C**: Stream 5 (통합)

---

## 위험 요소 및 대응

### ADK 1.25.1 SkillToolset -- 실험적(experimental) API
`SkillToolset`은 `@experimental(FeatureName.SKILL_TOOLSET)` 데코레이터가 적용되어 있다. 향후 API 변경 가능성이 있으므로, SkillToolset 사용을 `game_translator/skills/gws_sheets.py` 한 파일에 격리한다. API가 변경되면 이 파일만 수정하면 된다. 대안으로 SkillToolset 없이 일반 도구 함수(`gws_read_sheet`)만 사용하는 것도 가능하나, Skills 체계 도입이 설계 문서의 목표이므로 SkillToolset을 우선 사용한다.

### gws CLI 가용성
개발 환경에 gws CLI가 설치되어 있지 않다. 두 가지 대응:
1. `GwsService._run_gws`를 mock하는 `mock_gws_service` pytest fixture 제공 (Stream 2)
2. 서버 부트 시 gws CLI 설치/인증 상태를 로그에 출력하되, 서버 기동을 블로킹하지 않음 (Stream 2 작업 2.3)

### 프론트엔드 셀 편집 UX 변화
gws 프로젝트에서 셀 편집이 즉시 저장에서 배치 Apply로 바뀌는 것은 사용자 경험의 큰 변화다. 구체적 대응:
- pending 셀은 노란색 배경으로 시각적 구분
- ApplyBar는 sticky bottom으로 항상 가시적
- Discard 버튼으로 변경 취소 가능
- Apply 실패 시 에러 메시지를 ApplyBar에 표시, pending 데이터 유지

### Apply 부분 실패
gws CLI의 `spreadsheets.values.batchUpdate`는 원자적(atomic) 작업이므로 부분 실패가 발생하지 않는다. 전체 성공 또는 전체 실패. Apply 실패 시 pending 데이터를 applied로 마킹하지 않으므로, 사용자가 재시도할 수 있다. 부분 Apply(일부 셀만 선택 적용)는 v3 범위 밖이다.

---

## 주요 파일 경로 요약

### 수정 대상 (기존 파일)
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/pyproject.toml`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/requirements.txt`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/agent.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/__init__.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/prompts.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/tools/sheets.py` (locale regex 수정)
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/main.py` (서비스 초기화 + 라우터 등록)
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/models.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/services/project_service.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/routers/projects.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/routers/sheets.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/routers/jobs.py` (write detection + source_type 분기)
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/types/project.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/types/translation.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/api/sheets.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/api/projects.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/components/CreateProjectModal.tsx`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/pages/SheetViewer.tsx`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/components/layout/Sidebar.tsx`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/components/ProjectCard.tsx`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/lib/constants.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/hooks/useProjects.ts`

### 신규 생성
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/skills/__init__.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/skills/gws_sheets.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/tools/pending.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/game_translator/tools/gws_read.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/services/gws_service.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/services/pending_translations_service.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/routers/gws.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/backend/routers/translations.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/api/gws.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/components/ApplyBar.tsx`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/frontend/src/hooks/usePendingTranslations.ts`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/tests/conftest.py` (mock_gws_service fixture)
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/tests/test_agent_factory.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/tests/test_project_source_type.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/tests/test_gws_service.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/tests/test_pending_translations.py`
- `/Volumes/FablersBackup/Projects/TranslateForGameAgent/tests/test_apply_workflow.py`