# v1 Implementation Plan — WebSocket, Job History, Language Management

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace polling with WebSocket for job progress, persist job history to SQLite, and add language add/delete via table header.

**Architecture:** Backend-first — add SQLite job history, WebSocket endpoint, and language API. Then frontend — Job History page, WebSocket hook, language management UI. Mock layer updated in parallel.

**Tech Stack:** FastAPI WebSocket, aiosqlite, React useState+useEffect for WS, existing TanStack Query for fallback.

---

## Task 1: Backend — JobHistoryService (SQLite)

**Files:**
- Create: `backend/services/job_history_service.py`

**Step 1: Create JobHistoryService**

```python
# backend/services/job_history_service.py
import aiosqlite
from datetime import datetime, timezone


class JobHistoryService:
    def __init__(self, db_path: str = "jobs.db"):
        self.db_path = db_path

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS job_history (
                    job_id TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    sheet_name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    total_keys INTEGER DEFAULT 0,
                    processed_keys INTEGER DEFAULT 0,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    completed_at TEXT
                )
            """)
            await db.commit()

    async def save_job(self, job) -> None:
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT OR REPLACE INTO job_history
                (job_id, project_id, sheet_name, type, status, total_keys, processed_keys, error, created_at, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                job.job_id, job.project_id, job.sheet_name,
                job.type.value, job.status.value,
                job.total_keys, job.processed_keys,
                job.error, job.created_at,
                datetime.now(timezone.utc).isoformat(),
            ))
            await db.commit()

    async def list_jobs(self, project_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("""
                SELECT * FROM job_history
                WHERE project_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            """, (project_id, limit, offset))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]
```

**Step 2: Commit**
```bash
git add backend/services/job_history_service.py
git commit -m "feat(backend): add JobHistoryService with SQLite persistence"
```

---

## Task 2: Backend — Job History Router + Wire Into Main

**Files:**
- Create: `backend/routers/job_history.py`
- Modify: `backend/main.py`
- Modify: `backend/routers/jobs.py` (persist on completion/failure)
- Modify: `backend/models.py` (add JobHistoryEntry model)

**Step 1: Add JobHistoryEntry model to models.py**

```python
class JobHistoryEntry(_CamelModel):
    job_id: str
    project_id: str
    sheet_name: str
    type: JobType
    status: JobStatus
    total_keys: int = 0
    processed_keys: int = 0
    error: str | None = None
    created_at: str
    completed_at: str | None = None
```

**Step 2: Create job_history router**

```python
# backend/routers/job_history.py
from fastapi import APIRouter, Request
from backend.models import JobHistoryEntry

router = APIRouter(tags=["job_history"])

@router.get("/api/projects/{project_id}/jobs", response_model=list[JobHistoryEntry])
async def list_job_history(project_id: str, request: Request, limit: int = 50, offset: int = 0):
    history_svc = request.app.state.job_history_service
    rows = await history_svc.list_jobs(project_id, limit, offset)
    return [JobHistoryEntry(**row) for row in rows]
```

**Step 3: Wire into main.py**

- Import and initialize JobHistoryService in lifespan
- Call `await job_history_service.init_db()` at startup
- Store on `app.state.job_history_service`
- Include `job_history.router`

**Step 4: Persist completed/failed jobs in run_agent_job (jobs.py)**

After `job_svc.update_job(job_id, status=completed/failed, ...)`, add:
```python
history_svc = app.state.job_history_service
if history_svc:
    job = job_svc.get_job(job_id)
    await history_svc.save_job(job)
```

**Step 5: Commit**
```bash
git add backend/models.py backend/routers/job_history.py backend/main.py backend/routers/jobs.py
git commit -m "feat(backend): job history API — SQLite persistence + list endpoint"
```

---

## Task 3: Backend — WebSocket Progress

**Files:**
- Create: `backend/routers/ws.py`
- Modify: `backend/routers/jobs.py` (broadcast progress)
- Modify: `backend/main.py` (include ws router)

**Step 1: Create WebSocket endpoint with connection manager**

```python
# backend/routers/ws.py
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

_connections: dict[str, set[WebSocket]] = {}

async def broadcast_job_update(job_id: str, data: dict):
    connections = _connections.get(job_id, set()).copy()
    for ws in connections:
        try:
            await ws.send_json(data)
        except Exception:
            _connections.get(job_id, set()).discard(ws)

@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in _connections:
        _connections[job_id] = set()
    _connections[job_id].add(websocket)
    try:
        # Send current state immediately
        job_svc = websocket.app.state.job_service
        job = job_svc.get_job(job_id)
        if job:
            await websocket.send_json({
                "jobId": job.job_id, "status": job.status.value,
                "progress": job.progress, "processedKeys": job.processed_keys,
                "totalKeys": job.total_keys, "error": job.error,
            })
        # Keep alive until disconnect
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        _connections.get(job_id, set()).discard(websocket)
        if not _connections.get(job_id):
            _connections.pop(job_id, None)
```

**Step 2: Broadcast progress from run_agent_job**

After each `job_svc.update_job(...)` call, add:
```python
from backend.routers.ws import broadcast_job_update
await broadcast_job_update(job_id, {"jobId": job_id, "status": ..., "progress": ..., ...})
```

**Step 3: Wire ws router into main.py**

**Step 4: Commit**
```bash
git add backend/routers/ws.py backend/routers/jobs.py backend/main.py
git commit -m "feat(backend): WebSocket endpoint for real-time job progress"
```

---

## Task 4: Backend — Language Management API

**Files:**
- Modify: `backend/services/sheets_service.py` (add_language, delete_language)
- Modify: `backend/routers/sheets.py` (POST/DELETE language endpoints)
- Modify: `backend/models.py` (AddLanguagePayload)

**Step 1: Add methods to SheetsService**

```python
def add_language(self, project_id, sheet_name, code, label) -> bool:
    # Add header column + empty cells for all rows

def delete_language(self, project_id, sheet_name, code) -> int:
    # Remove column, return count of deleted non-empty translations
```

**Step 2: Add model + endpoints**

```python
class AddLanguagePayload(_CamelModel):
    code: str
    label: str

# POST /api/projects/{pid}/sheets/{sheet}/languages
# DELETE /api/projects/{pid}/sheets/{sheet}/languages/{code}
```

**Step 3: Commit**
```bash
git add backend/services/sheets_service.py backend/routers/sheets.py backend/models.py
git commit -m "feat(backend): language add/delete API — CSV column management"
```

---

## Task 5: Frontend — Types, Constants, API Functions

**Files:**
- Modify: `frontend/src/types/translation.ts` (add JobHistoryEntry)
- Modify: `frontend/src/lib/constants.ts` (add query keys)
- Create: `frontend/src/api/jobHistory.ts`
- Modify: `frontend/src/api/sheets.ts` (add/delete language functions)
- Modify: `frontend/src/api/mock/data.ts` (mock job history + language management)
- Modify: `frontend/src/api/mock/handlers.ts` (new routes)

**Step 1: Add types**

```typescript
export interface JobHistoryEntry {
  jobId: string; projectId: string; sheetName: string;
  type: JobType; status: JobStatus;
  totalKeys: number; processedKeys: number;
  error?: string; createdAt: string; completedAt?: string;
}
```

**Step 2: Add query keys**
```typescript
jobHistory: (projectId: string) => ['jobHistory', projectId] as const,
```

**Step 3: Add API functions + mock handlers**

**Step 4: Commit**
```bash
git add frontend/src/types/ frontend/src/lib/constants.ts frontend/src/api/
git commit -m "feat(frontend): v1 types, API functions, mock handlers"
```

---

## Task 6: Frontend — Job History Page + Sidebar + Router

**Files:**
- Create: `frontend/src/hooks/useJobHistory.ts`
- Create: `frontend/src/pages/JobHistory.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx` (add Job History link)
- Modify: `frontend/src/App.tsx` (add route)

**Step 1: Create hook + page following Pencil design**
- Table: Type (icon + label), Sheet, Status (color badge), Keys, Started, Duration
- Status badges: Completed(green), Failed(red)

**Step 2: Add to sidebar and router**

**Step 3: Commit**
```bash
git add frontend/src/hooks/useJobHistory.ts frontend/src/pages/JobHistory.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat(frontend): Job History page with sidebar navigation"
```

---

## Task 7: Frontend — WebSocket Progress Hook

**Files:**
- Modify: `frontend/src/hooks/useTranslation.ts`

**Step 1: Replace polling with WebSocket**

- In real API mode: open WebSocket on job trigger, listen for progress, close on completion
- In mock mode: keep polling fallback (refetchInterval: 1500)
- On WebSocket error: fall back to polling
- Constraint: "진행률 표시가 중단되지 않을 것"

**Step 2: Commit**
```bash
git add frontend/src/hooks/useTranslation.ts
git commit -m "feat(frontend): WebSocket progress — replace polling, mock fallback"
```

---

## Task 8: Frontend — Language Management UI

**Files:**
- Create: `frontend/src/components/AddLanguageModal.tsx`
- Create: `frontend/src/components/DeleteLanguageDialog.tsx`
- Modify: `frontend/src/components/DataTable.tsx` (header buttons)
- Modify: `frontend/src/pages/SheetViewer.tsx` (wire modals)
- Create: `frontend/src/hooks/useLanguages.ts`

**Step 1: Create AddLanguageModal (following Pencil design)**
- Code + Label inputs, "Translate now" checkbox
- On confirm: call add language API, optionally trigger translate

**Step 2: Create DeleteLanguageDialog (following Pencil design)**
- Warning with deletion count, red delete button
- On confirm: call delete language API

**Step 3: Modify DataTable header**
- Each non-source language header gets an "x" delete icon
- Last column: "+" add button

**Step 4: Wire into SheetViewer**

**Step 5: Commit**
```bash
git add frontend/src/components/AddLanguageModal.tsx frontend/src/components/DeleteLanguageDialog.tsx frontend/src/components/DataTable.tsx frontend/src/pages/SheetViewer.tsx frontend/src/hooks/useLanguages.ts
git commit -m "feat(frontend): language add/delete UI with confirm/warning dialogs"
```

---

## Task 9: Integration Verification

- Start backend + frontend with VITE_MOCK_API=false
- Test: Job History page loads and shows past jobs
- Test: Translate All → WebSocket progress in banner
- Test: Add language → new column appears → optionally translate
- Test: Delete language → warning dialog → column removed
- Clean up test data, restore VITE_MOCK_API=true
