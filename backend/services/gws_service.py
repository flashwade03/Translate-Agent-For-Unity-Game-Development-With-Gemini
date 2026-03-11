import asyncio
import json
import logging
import os
import re
import tempfile

from backend.models import SheetData, Language

logger = logging.getLogger("gws_service")


def _col_to_a1(col_index: int) -> str:
    """Convert 0-based column index to A1 notation letters.
    0 -> A, 25 -> Z, 26 -> AA, 27 -> AB, ... 701 -> ZZ
    """
    result = ""
    idx = col_index
    while True:
        result = chr(ord("A") + idx % 26) + result
        idx = idx // 26 - 1
        if idx < 0:
            break
    return result


class GwsError(Exception):
    """Base error for gws CLI operations."""
    pass


class GwsAuthError(GwsError):
    """gws CLI authentication error."""
    pass


class GwsTimeoutError(GwsError):
    """gws CLI timeout."""
    pass


class GwsParseError(GwsError):
    """Failed to parse gws CLI output."""
    pass


GWS_TIMEOUT = 30  # seconds

# Input validation patterns
_SPREADSHEET_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")
_TAB_NAME_RE = re.compile(r"^[^/\\'\"\x00]{1,200}$")


def _validate_spreadsheet_id(spreadsheet_id: str) -> None:
    """Validate spreadsheet ID to prevent argument injection."""
    if not spreadsheet_id or not _SPREADSHEET_ID_RE.match(spreadsheet_id):
        raise GwsError(f"Invalid spreadsheet ID: must be alphanumeric/hyphen/underscore")


def _validate_tab_name(tab_name: str) -> None:
    """Validate tab name to prevent argument injection."""
    if not tab_name or not _TAB_NAME_RE.match(tab_name):
        raise GwsError(f"Invalid tab name: contains forbidden characters or is too long")


class GwsService:
    async def _run_gws(self, *args: str, stdin_data: str | None = None) -> dict:
        """Run a gws CLI command and return parsed JSON output.

        Raises GwsAuthError, GwsTimeoutError, GwsParseError, GwsError.
        """
        cmd = ["gws"] + list(args) + ["--format=json"]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE if stdin_data else None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(
                proc.communicate(input=stdin_data.encode("utf-8") if stdin_data else None),
                timeout=GWS_TIMEOUT,
            )
        except asyncio.TimeoutError:
            raise GwsTimeoutError(f"gws command timed out after {GWS_TIMEOUT}s: {' '.join(cmd)}")

        stderr_text = stderr.decode("utf-8", errors="replace").strip()

        if proc.returncode != 0:
            # Detect auth errors
            if any(kw in stderr_text.lower() for kw in ["unauthorized", "token expired", "invalid_grant", "auth"]):
                raise GwsAuthError(f"gws authentication error: {stderr_text}")
            raise GwsError(f"gws command failed (exit {proc.returncode}): {stderr_text}")

        stdout_text = stdout.decode("utf-8", errors="replace").strip()
        if not stdout_text:
            raise GwsParseError("gws returned empty output")

        try:
            return json.loads(stdout_text)
        except json.JSONDecodeError as e:
            raise GwsParseError(f"Failed to parse gws output as JSON: {e}\nOutput: {stdout_text[:500]}")

    async def check_auth(self) -> bool:
        """Check if gws CLI is authenticated. Returns True if auth is valid."""
        try:
            await self._run_gws("auth", "status")
            return True
        except (GwsError, FileNotFoundError):
            return False

    async def check_cli_installed(self) -> bool:
        """Check if gws CLI is installed and accessible."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "gws", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            return proc.returncode == 0
        except FileNotFoundError:
            return False

    async def list_tabs(self, spreadsheet_id: str) -> list[str]:
        """List tab names in a spreadsheet."""
        _validate_spreadsheet_id(spreadsheet_id)
        result = await self._run_gws(
            "sheets", "spreadsheets.get",
            f"--spreadsheetId={spreadsheet_id}",
            "--fields=sheets.properties.title",
        )
        sheets = result.get("sheets", [])
        return [s["properties"]["title"] for s in sheets if "properties" in s]

    async def read_tab(self, spreadsheet_id: str, tab_name: str) -> SheetData:
        """Read tab data and return as SheetData (same structure as CSV)."""
        _validate_spreadsheet_id(spreadsheet_id)
        _validate_tab_name(tab_name)
        result = await self._run_gws(
            "sheets", "spreadsheets.values.get",
            f"--spreadsheetId={spreadsheet_id}",
            f"--range={tab_name}",
        )
        values = result.get("values", [])
        if not values:
            return SheetData(sheet_name=tab_name, headers=["Key"], languages=[], rows=[])

        headers = values[0]
        raw_rows = values[1:]

        # Parse language headers (same logic as sheets_service.py)
        languages: list[Language] = []
        for h in headers[1:]:
            m = re.match(r"(.+)\(([^)]+)\)", h)
            if m:
                languages.append(Language(code=m.group(2), label=m.group(1), is_source=False))
        if languages:
            languages[0].is_source = True

        rows = []
        for raw_row in raw_rows:
            row = {"key": raw_row[0] if raw_row else ""}
            for i, lang in enumerate(languages):
                row[lang.code] = raw_row[i + 1] if i + 1 < len(raw_row) else ""
            rows.append(row)

        return SheetData(sheet_name=tab_name, headers=headers, languages=languages, rows=rows)

    async def batch_update(
        self, spreadsheet_id: str, tab_name: str, updates: list[dict]
    ) -> int:
        """Write translation results to Google Sheets.

        Each update dict has: key, lang_code, value, row_index, col_index.
        Uses batchUpdate for atomicity.

        Returns number of updated cells.
        Raises GwsError on failure (no partial writes).
        """
        _validate_spreadsheet_id(spreadsheet_id)
        _validate_tab_name(tab_name)
        if not updates:
            return 0

        data = []
        for u in updates:
            col_letter = _col_to_a1(u["col_index"])
            cell_ref = f"{tab_name}!{col_letter}{u['row_index'] + 2}"  # +2 for 1-indexed + header
            data.append({"range": cell_ref, "values": [[u["value"]]]})

        payload = {
            "valueInputOption": "RAW",
            "data": data,
        }

        # Write payload to temp file to avoid shell escaping issues
        # with JSON special characters in subprocess args.
        fd, tmp_path = tempfile.mkstemp(suffix=".json", prefix="gws_batch_")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)

            result = await self._run_gws(
                "sheets", "spreadsheets.values.batchUpdate",
                f"--spreadsheetId={spreadsheet_id}",
                f"--request.body=@{tmp_path}",
            )
        finally:
            os.unlink(tmp_path)

        return result.get("totalUpdatedCells", len(updates))
