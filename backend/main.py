import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

FRONTEND_PORT = os.environ.get("FRONTEND_PORT", "5173")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    from backend.services.sheets_service import SheetsService
    from backend.services.job_service import JobService
    from backend.services.config_service import ConfigService

    app.state.sheets_service = SheetsService()
    app.state.job_service = JobService()
    app.state.config_service = ConfigService()

    from backend.services.job_history_service import JobHistoryService
    job_history_service = JobHistoryService()
    await job_history_service.init_db()
    app.state.job_history_service = job_history_service

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


app = FastAPI(title="Game Translator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"http://localhost:{FRONTEND_PORT}"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from backend.routers import projects, config, sheets, jobs, job_history, ws, languages  # noqa: E402

app.include_router(projects.router)
app.include_router(config.router)
app.include_router(sheets.router)
app.include_router(jobs.router)
app.include_router(job_history.router)
app.include_router(ws.router)
app.include_router(languages.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
