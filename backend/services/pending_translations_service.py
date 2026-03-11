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
