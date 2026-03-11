"""Google Sheets read tool using gws CLI for the translation agent."""

import json
import re
import subprocess

_SPREADSHEET_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
_TAB_NAME_RE = re.compile(r"^[^/\\'\"\x00]{1,200}$")


def gws_read_sheet(spreadsheet_id: str, tab_name: str) -> dict:
    """Read all data from a Google Sheets tab using gws CLI.

    Runs the gws CLI to fetch spreadsheet values and converts the output
    to the same format as the CSV read_sheet tool.

    Args:
        spreadsheet_id: The Google Sheets spreadsheet ID.
        tab_name: The tab/sheet name to read.

    Returns:
        Dict with 'headers', 'languages', 'rows' matching CSV read_sheet format.
        Returns error dict on failure.
    """
    if not spreadsheet_id or not _SPREADSHEET_ID_RE.match(spreadsheet_id):
        return {"error": "Invalid spreadsheet ID: must be alphanumeric/hyphen/underscore"}
    if not tab_name or not _TAB_NAME_RE.match(tab_name):
        return {"error": "Invalid tab name: contains forbidden characters or is too long"}

    params = json.dumps({
        "spreadsheetId": spreadsheet_id,
        "range": tab_name,
    })
    try:
        result = subprocess.run(
            [
                "gws", "sheets", "spreadsheets", "values", "get",
                "--params", params,
                "--format=json",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except FileNotFoundError:
        return {"error": "gws CLI is not installed or not in PATH"}
    except subprocess.TimeoutExpired:
        return {"error": "gws CLI command timed out after 30 seconds"}

    if result.returncode != 0:
        error_text = result.stdout.strip() or result.stderr.strip()
        return {"error": f"gws CLI failed (exit {result.returncode}): {error_text}"}

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse gws output: {e}"}

    # Extract values from gws response
    values = data.get("values", [])
    if not values:
        return {"error": "No data found in the sheet"}

    headers = values[0]
    raw_rows = values[1:]

    # Parse language headers: "English(en)" -> {code, label}
    languages = []
    for h in headers[1:]:
        m = re.match(r"(.+)\(([^)]+)\)", h)
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
