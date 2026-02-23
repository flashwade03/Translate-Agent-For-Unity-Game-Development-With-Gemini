import csv
import re
from pathlib import Path

from backend.models import SheetData, Language

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


class SheetsService:
    def __init__(self, projects_dir: Path = PROJECTS_DIR):
        self.projects_dir = projects_dir

    def list_sheets(self, project_id: str) -> list[str]:
        """List CSV files in projects/<id>/sheets/."""
        sheets_dir = self.projects_dir / project_id / "sheets"
        if not sheets_dir.exists():
            return []
        return sorted(f.stem for f in sheets_dir.glob("*.csv"))

    def get_sheet_data(self, project_id: str, sheet_name: str) -> SheetData | None:
        """Read a CSV file and return structured SheetData."""
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return None

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                return None
            raw_rows = list(reader)

        # Parse language headers: "English(en)" -> Language(code="en", label="English")
        languages: list[Language] = []
        for h in headers[1:]:  # skip 'key' column
            m = re.match(r"(.+)\((\w+)\)", h)
            if m:
                languages.append(Language(code=m.group(2), label=m.group(1), is_source=False))

        # First language is source by default
        if languages:
            languages[0].is_source = True

        # Convert rows to dicts
        rows: list[dict[str, str]] = []
        for raw_row in raw_rows:
            row: dict[str, str] = {"key": raw_row[0] if raw_row else ""}
            for i, lang in enumerate(languages):
                row[lang.code] = raw_row[i + 1] if i + 1 < len(raw_row) else ""
            rows.append(row)

        return SheetData(
            sheet_name=sheet_name,
            headers=headers,
            languages=languages,
            rows=rows,
        )

    def update_cells(self, project_id: str, sheet_name: str, updates: list[dict]) -> bool:
        """Update specific cells in a CSV file.

        Each update dict has: key, lang_code, value.
        """
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return False

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                return False
            raw_rows = list(reader)

        # Build column index: lang_code -> column index
        col_index: dict[str, int] = {}
        for i, h in enumerate(headers[1:], start=1):
            m = re.match(r".+\((\w+)\)", h)
            if m:
                col_index[m.group(1)] = i

        # Build key -> row index
        key_index: dict[str, int] = {}
        for i, row in enumerate(raw_rows):
            if row:
                key_index[row[0]] = i

        # Apply updates
        for u in updates:
            key = u.get("key", "")
            lang_code = u.get("lang_code", "")
            value = u.get("value", "")
            row_idx = key_index.get(key)
            col_idx = col_index.get(lang_code)
            if row_idx is not None and col_idx is not None:
                # Extend row if needed
                while len(raw_rows[row_idx]) <= col_idx:
                    raw_rows[row_idx].append("")
                raw_rows[row_idx][col_idx] = value

        # Write back
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(raw_rows)

        return True
