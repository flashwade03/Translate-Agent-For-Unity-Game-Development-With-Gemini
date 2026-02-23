# Backend Implementation Design

## Goal

FastAPI 서버로 프론트엔드 mock API 16개 엔드포인트를 실제 구현으로 치환. ADK Runner로 에이전트 실행, MCP 클라이언트로 Sheets 연동.

## API Contract (프론트엔드 mock에서 추출)

### Projects
- `GET /api/projects` → Project[]
- `GET /api/projects/:projectId` → Project
- `POST /api/projects` → Project (body: { name, description, spreadsheetId })

### Sheets (MCP 클라이언트 사용)
- `GET /api/projects/:projectId/sheets` → string[]
- `GET /api/projects/:projectId/sheets/:sheetName` → SheetData
- `PUT /api/projects/:projectId/sheets/:sheetName/rows` → { ok: true } (body: { key, langCode, value }[])

### Sheet Settings (YAML)
- `GET /api/projects/:projectId/sheets/:sheetName/settings` → SheetSettings
- `PUT /api/projects/:projectId/sheets/:sheetName/settings` → SheetSettings

### Glossary (YAML)
- `GET /api/projects/:projectId/glossary` → Glossary
- `POST /api/projects/:projectId/glossary` → GlossaryEntry
- `PUT /api/projects/:projectId/glossary/:entryId` → GlossaryEntry
- `DELETE /api/projects/:projectId/glossary/:entryId` → { ok: true }

### Style Guide (YAML)
- `GET /api/projects/:projectId/style-guide` → StyleGuide
- `PUT /api/projects/:projectId/style-guide` → StyleGuide

### Jobs (ADK Runner)
- `POST /api/projects/:projectId/sheets/:sheetName/jobs` → TranslationJob (body: { type })
- `GET /api/jobs/:jobId` → TranslationJob

### Review Report
- `GET /api/projects/:projectId/sheets/:sheetName/review` → ReviewReport

## Architectural Decisions

- **FastAPI + ADK Runner** — because 커스텀 REST API 필요 (프론트엔드가 챗 UI가 아닌 대시보드), ADK의 내장 서버는 대화형 인터페이스용.
- **MCP 클라이언트 공유** — because `mcp-google-sheets` 프로세스를 앱 시작 시 1개 띄우고, Sheets 라우터(직접 조회)와 Agent(번역 작업) 양쪽에서 사용. 사용자 결정.
- **In-memory Job Store (v0)** — because v0에서 Job 이력 영속화 불필요. `dict[str, TranslationJob]`.
- **DatabaseSessionService (SQLite)** — because 에이전트 대화 히스토리 영속 저장. Runner에 주입.
- **YAML CRUD** — because projects/<name>/ 디렉토리의 YAML 파일을 직접 읽기/쓰기. DB 불필요.
- **BackgroundTasks** — because FastAPI의 BackgroundTasks로 비동기 Job 실행. Job POST 즉시 반환.

## Directory Structure

```
backend/
├── main.py              # FastAPI app, lifespan (MCP/Runner 초기화)
├── dependencies.py       # 공유 의존성 (Runner, MCP client, SessionService)
├── routers/
│   ├── projects.py      # Projects CRUD
│   ├── sheets.py        # Sheets 조회/수정 (MCP)
│   ├── config.py        # Sheet Settings + Glossary + Style Guide
│   └── jobs.py          # Translation Jobs + Review Report
└── services/
    ├── project_service.py  # YAML 기반 프로젝트 관리
    ├── sheets_service.py   # MCP Google Sheets 클라이언트 래핑
    └── job_service.py      # In-memory job store + ADK Runner 실행
```

## Constraints

- Must: 프론트엔드 mock API 계약과 정확히 동일한 경로/응답 형태
- Must: 번역 요청 시 즉시 job ID 반환 (blocking 금지)
- Must not: 에이전트 내부 로직을 API 레이어에서 직접 구현하지 않을 것
- Must not: 스프레드시트 데이터를 로컬에 저장하지 않을 것

## Response Type References

프론트엔드 TypeScript 타입 정의 (backend/의 Pydantic 모델이 이것과 일치해야 함):
- `frontend/src/types/project.ts` — Project, CreateProjectPayload
- `frontend/src/types/sheet.ts` — SheetData, SheetRow, Language
- `frontend/src/types/translation.ts` — TranslationJob, JobStatus, JobType
- `frontend/src/types/glossary.ts` — Glossary, GlossaryEntry
- `frontend/src/types/styleGuide.ts` — StyleGuide
- `frontend/src/types/sheetSettings.ts` — SheetSettings
- `frontend/src/types/review.ts` — ReviewReport, ReviewIssue
