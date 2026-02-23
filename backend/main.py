from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- Startup ---
    from backend.services.sheets_service import SheetsService
    from backend.services.job_service import JobService

    app.state.sheets_service = SheetsService()
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


app = FastAPI(title="Game Translator API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from backend.routers import projects, config, sheets, jobs  # noqa: E402

app.include_router(projects.router)
app.include_router(config.router)
app.include_router(sheets.router)
app.include_router(jobs.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
