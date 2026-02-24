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

    def add_language(self, project_id: str, sheet_name: str, code: str, label: str) -> bool:
        """Add a new language column to a CSV file. Returns True on success."""
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return False

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                return False
            rows = list(reader)

        header_str = f"{label}({code})"
        if header_str in headers:
            return False  # Language already exists

        headers.append(header_str)
        for row in rows:
            row.append("")  # Empty cell for new language

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

        return True

    def delete_language(self, project_id: str, sheet_name: str, code: str) -> int:
        """Delete a language column from CSV. Returns count of deleted non-empty translations, or -1 on error."""
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return -1

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                return -1
            rows = list(reader)

        # Find column index for this language code
        col_idx = None
        for i, h in enumerate(headers[1:], start=1):
            m = re.match(r".+\((\w+)\)", h)
            if m and m.group(1) == code:
                col_idx = i
                break

        if col_idx is None:
            return -1

        # Count non-empty translations that will be deleted
        deleted_count = sum(1 for row in rows if col_idx < len(row) and row[col_idx])

        # Remove column
        new_headers = headers[:col_idx] + headers[col_idx + 1:]
        new_rows = [row[:col_idx] + row[col_idx + 1:] for row in rows]

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(new_headers)
            writer.writerows(new_rows)

        return deleted_count

    def add_row(self, project_id: str, sheet_name: str, key: str) -> bool:
        """Add a new row with the given key and empty values. Returns False if key already exists."""
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return False

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                return False
            rows = list(reader)

        # Check for duplicate key
        if any(row[0] == key for row in rows if row):
            return False

        # Add new row: key + empty strings for each language column
        new_row = [key] + [""] * (len(headers) - 1)
        rows.append(new_row)

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

        return True

    def delete_rows(self, project_id: str, sheet_name: str, keys: list[str]) -> int:
        """Delete rows by key names. Returns count of actually deleted rows."""
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return 0

        keys_set = set(keys)

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader, None)
            if not headers:
                return 0
            rows = list(reader)

        original_count = len(rows)
        rows = [r for r in rows if not r or r[0] not in keys_set]

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

        return original_count - len(rows)

    def create_sheet(self, project_id: str, sheet_name: str) -> bool:
        """Create a new empty CSV sheet. Copies language headers from an existing sheet if any."""
        sheets_dir = self.projects_dir / project_id / "sheets"
        sheets_dir.mkdir(parents=True, exist_ok=True)
        csv_path = sheets_dir / f"{sheet_name}.csv"
        if csv_path.exists():
            return False

        # Copy headers from first existing sheet, or default to just 'key'
        headers = ["key"]
        existing = sorted(sheets_dir.glob("*.csv"))
        if existing:
            with open(existing[0], newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                first_row = next(reader, None)
                if first_row:
                    headers = first_row

        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(headers)

        return True

    def delete_sheet(self, project_id: str, sheet_name: str) -> int:
        """Delete a CSV sheet. Returns the number of rows (keys) that were deleted, or -1 if not found."""
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            return -1

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # skip headers
            key_count = sum(1 for _ in reader)

        csv_path.unlink()
        return key_count
