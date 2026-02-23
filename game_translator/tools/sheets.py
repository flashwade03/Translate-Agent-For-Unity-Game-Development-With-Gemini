"""CSV-based sheet read/write tools for the translation agent."""

import csv
import re
from pathlib import Path

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


def read_sheet(project_id: str, sheet_name: str) -> dict:
    """Read a CSV sheet file and return its contents.

    Args:
        project_id: The project identifier (directory name under projects/).
        sheet_name: The sheet name (CSV filename without extension).

    Returns:
        A dict with keys: headers (list[str]), languages (list[dict]),
        rows (list[dict]) where each row maps language codes to values.
        Returns an error dict if the file is not found.
    """
    csv_path = PROJECTS_DIR / project_id / "sheets" / f"{sheet_name}.csv"
    if not csv_path.exists():
        return {"error": f"Sheet '{sheet_name}' not found in project '{project_id}'"}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader, None)
        if not headers:
            return {"error": "Empty CSV file"}
        raw_rows = list(reader)

    # Parse language headers: "English(en)" -> {code, label}
    languages = []
    for h in headers[1:]:
        m = re.match(r"(.+)\((\w+)\)", h)
        if m:
            languages.append({"code": m.group(2), "label": m.group(1)})

    # Convert rows to dicts
    rows = []
    for raw_row in raw_rows:
        row = {"key": raw_row[0] if raw_row else ""}
        for i, lang in enumerate(languages):
            row[lang["code"]] = raw_row[i + 1] if i + 1 < len(raw_row) else ""
        rows.append(row)

    return {
        "headers": headers,
        "languages": languages,
        "rows": rows,
    }


def write_sheet(project_id: str, sheet_name: str, updates: list[dict]) -> dict:
    """Write translation results back to a CSV sheet file.

    Each update is a dict with keys: key, lang_code, value.

    Args:
        project_id: The project identifier.
        sheet_name: The sheet name (CSV filename without extension).
        updates: List of dicts, each with 'key', 'lang_code', 'value'.

    Returns:
        A dict with 'updated' count on success, or 'error' on failure.
    """
    csv_path = PROJECTS_DIR / project_id / "sheets" / f"{sheet_name}.csv"
    if not csv_path.exists():
        return {"error": f"Sheet '{sheet_name}' not found in project '{project_id}'"}

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        headers = next(reader, None)
        if not headers:
            return {"error": "Empty CSV file"}
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

    updated = 0
    for u in updates:
        key = u.get("key", "")
        lang_code = u.get("lang_code", "")
        value = u.get("value", "")
        row_idx = key_index.get(key)
        col_idx = col_index.get(lang_code)
        if row_idx is not None and col_idx is not None:
            while len(raw_rows[row_idx]) <= col_idx:
                raw_rows[row_idx].append("")
            raw_rows[row_idx][col_idx] = value
            updated += 1

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(raw_rows)

    return {"updated": updated}
