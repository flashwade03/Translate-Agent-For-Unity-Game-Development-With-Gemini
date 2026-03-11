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
