from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _to_camel(field_name: str) -> str:
    """Convert snake_case to camelCase for JSON serialization."""
    parts = field_name.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


class _CamelModel(BaseModel):
    """Base model that serializes field names as camelCase."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobType(str, Enum):
    translate_all = "translate_all"
    update = "update"
    review = "review"


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


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------


class Project(_CamelModel):
    id: str
    name: str
    description: str
    spreadsheet_id: str
    sheet_count: int = 0
    last_translated_at: str | None = None
    created_at: str


class CreateProjectPayload(_CamelModel):
    name: str
    description: str
    spreadsheet_id: str


# ---------------------------------------------------------------------------
# Sheet
# ---------------------------------------------------------------------------


class Language(_CamelModel):
    code: str
    label: str
    is_source: bool


# SheetRow is a dict with a required "key" and arbitrary lang-code values.
# We use dict[str, str] in Python; no dedicated model needed.
SheetRow = dict[str, str]


class SheetData(_CamelModel):
    sheet_name: str
    headers: list[str]
    languages: list[Language]
    rows: list[SheetRow]


# ---------------------------------------------------------------------------
# Translation Job
# ---------------------------------------------------------------------------


class TranslationJob(_CamelModel):
    job_id: str
    project_id: str
    sheet_name: str
    type: JobType
    status: JobStatus = JobStatus.pending
    progress: int = 0
    total_keys: int = 0
    processed_keys: int = 0
    error: str | None = None
    created_at: str


class JobCreatePayload(_CamelModel):
    type: JobType


# ---------------------------------------------------------------------------
# Glossary
# ---------------------------------------------------------------------------


class GlossaryEntry(_CamelModel):
    id: str
    source: str
    target: str
    context: str | None = None
    language: str


class GlossaryEntryCreate(_CamelModel):
    source: str
    target: str
    context: str | None = None
    language: str


class Glossary(_CamelModel):
    project_id: str
    entries: list[GlossaryEntry]


# ---------------------------------------------------------------------------
# Style Guide
# ---------------------------------------------------------------------------


class StyleGuide(_CamelModel):
    project_id: str
    tone: str = ""
    formality: str = "neutral"
    audience: str = ""
    rules: str = ""
    examples: str = ""


# ---------------------------------------------------------------------------
# Sheet Settings
# ---------------------------------------------------------------------------


class SheetSettings(_CamelModel):
    project_id: str
    sheet_name: str
    source_language: str = "en"
    translation_style: str = "casual"
    character_limit: int | None = None
    glossary_override: bool = False
    instructions: str = ""


# ---------------------------------------------------------------------------
# Review
# ---------------------------------------------------------------------------


class ReviewIssue(_CamelModel):
    id: str
    key: str
    language: str
    severity: IssueSeverity
    category: IssueCategory
    message: str
    suggestion: str | None = None
    original: str
    translated: str


class ReviewReport(_CamelModel):
    project_id: str
    sheet_name: str
    total_keys: int
    reviewed_keys: int
    issues: list[ReviewIssue]
    created_at: str


# ---------------------------------------------------------------------------
# Misc request bodies
# ---------------------------------------------------------------------------


class RowUpdate(_CamelModel):
    key: str
    lang_code: str
    value: str
