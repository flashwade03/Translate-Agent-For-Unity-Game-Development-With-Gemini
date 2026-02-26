import csv
import re
from pathlib import Path

from io import StringIO

from backend.models import SheetData, Language, CsvUploadResult, ProjectLanguage

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
            m = re.match(r"(.+)\(([^)]+)\)", h)
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
            m = re.match(r".+\(([^)]+)\)", h)
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
            m = re.match(r".+\(([^)]+)\)", h)
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

    def delete_language_from_all_sheets(self, project_id: str, code: str) -> dict:
        """Delete a language column from all CSV sheets. Returns stats."""
        sheets_dir = self.projects_dir / project_id / "sheets"
        if not sheets_dir.exists():
            return {"affected_sheets": 0, "affected_translations": 0}

        affected_sheets = 0
        affected_translations = 0

        for csv_file in sorted(sheets_dir.glob("*.csv")):
            count = self.delete_language(project_id, csv_file.stem, code)
            if count >= 0:
                affected_sheets += 1
                affected_translations += count

        return {"affected_sheets": affected_sheets, "affected_translations": affected_translations}

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
        """Create a new empty CSV sheet using project language config for headers."""
        sheets_dir = self.projects_dir / project_id / "sheets"
        sheets_dir.mkdir(parents=True, exist_ok=True)
        csv_path = sheets_dir / f"{sheet_name}.csv"
        if csv_path.exists():
            return False

        # Try to read languages from project config.yaml
        import yaml
        config_path = self.projects_dir / project_id / "config.yaml"
        headers = ["Key"]
        if config_path.exists():
            with open(config_path) as f:
                cfg = yaml.safe_load(f) or {}
            langs = cfg.get("languages") or []
            if langs:
                headers = ["Key"] + [f"{l['label']}({l['code']})" for l in langs]

        # Fallback: copy from existing sheet if no project languages
        if len(headers) == 1:
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

    def merge_csv(
        self,
        project_id: str,
        sheet_name: str,
        csv_content: str,
        config_service=None,
    ) -> CsvUploadResult:
        """Merge uploaded CSV into an existing sheet by key.

        - Existing keys: overwrite all values from upload
        - New keys: append rows
        - New languages in upload: add columns to this sheet + project config
        Returns merge statistics.
        Raises ValueError if CSV format is invalid.
        """
        # Parse uploaded CSV
        reader = csv.reader(StringIO(csv_content))
        upload_headers = next(reader, None)
        if not upload_headers:
            raise ValueError("Empty CSV file")

        # Validate Unity format: first column must be "Key" (case-insensitive)
        if upload_headers[0].strip().lower() != "key":
            raise ValueError("First column must be 'Key'")

        # Parse upload language headers
        upload_langs: list[tuple[str, str]] = []  # (code, header_str)
        for h in upload_headers[1:]:
            m = re.match(r"(.+)\(([^)]+)\)", h.strip())
            if not m:
                raise ValueError(f"Invalid header format: '{h}'. Expected 'Label(locale)'")
            upload_langs.append((m.group(2), h.strip()))

        upload_rows = list(reader)

        # Read existing sheet
        csv_path = self.projects_dir / project_id / "sheets" / f"{sheet_name}.csv"
        if not csv_path.exists():
            raise ValueError(f"Sheet '{sheet_name}' not found")

        with open(csv_path, newline="", encoding="utf-8") as f:
            existing_reader = csv.reader(f)
            existing_headers = next(existing_reader, None) or ["Key"]
            existing_rows = list(existing_reader)

        # Build existing language code -> column index map
        existing_col_index: dict[str, int] = {}
        for i, h in enumerate(existing_headers[1:], start=1):
            m = re.match(r".+\(([^)]+)\)", h)
            if m:
                existing_col_index[m.group(1)] = i

        # Detect new languages and add columns
        added_languages: list[ProjectLanguage] = []
        upload_col_map: list[int] = []  # upload lang index -> existing col index

        for code, header_str in upload_langs:
            if code in existing_col_index:
                upload_col_map.append(existing_col_index[code])
            else:
                # New language column — append to headers
                new_idx = len(existing_headers)
                existing_headers.append(header_str)
                existing_col_index[code] = new_idx
                upload_col_map.append(new_idx)
                # Extend existing rows with empty cells
                for row in existing_rows:
                    row.append("")

                # Parse label from header
                m = re.match(r"(.+)\(([^)]+)\)", header_str)
                label = m.group(1) if m else code
                added_languages.append(ProjectLanguage(code=code, label=label))

        # Auto-add new languages to project config + other sheets
        if config_service and added_languages:
            for lang in added_languages:
                config_service.add_project_language(project_id, lang.code, lang.label)
            # Add columns to other sheets
            other_sheets = self.list_sheets(project_id)
            for other in other_sheets:
                if other != sheet_name:
                    for lang in added_languages:
                        self.add_language(project_id, other, lang.code, lang.label)

        # Build existing key -> row index map
        existing_key_index: dict[str, int] = {}
        for i, row in enumerate(existing_rows):
            if row:
                existing_key_index[row[0]] = i

        # Merge rows
        added_keys = 0
        updated_keys = 0
        num_cols = len(existing_headers)

        for upload_row in upload_rows:
            if not upload_row:
                continue
            key = upload_row[0]
            if key in existing_key_index:
                # Overwrite existing row values
                row_idx = existing_key_index[key]
                for ul_idx, col_idx in enumerate(upload_col_map):
                    value = upload_row[ul_idx + 1] if ul_idx + 1 < len(upload_row) else ""
                    while len(existing_rows[row_idx]) <= col_idx:
                        existing_rows[row_idx].append("")
                    existing_rows[row_idx][col_idx] = value
                updated_keys += 1
            else:
                # New key — append row
                new_row = [""] * num_cols
                new_row[0] = key
                for ul_idx, col_idx in enumerate(upload_col_map):
                    value = upload_row[ul_idx + 1] if ul_idx + 1 < len(upload_row) else ""
                    new_row[col_idx] = value
                existing_rows.append(new_row)
                existing_key_index[key] = len(existing_rows) - 1
                added_keys += 1

        # Write back
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(existing_headers)
            writer.writerows(existing_rows)

        return CsvUploadResult(
            added_keys=added_keys,
            updated_keys=updated_keys,
            added_languages=added_languages,
        )

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
