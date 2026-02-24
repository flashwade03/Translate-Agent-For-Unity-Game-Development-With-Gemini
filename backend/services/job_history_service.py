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
