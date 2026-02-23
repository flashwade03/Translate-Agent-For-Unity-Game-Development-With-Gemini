import json
import os
import re
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from backend.models import SheetData, Language


class SheetsService:
    def __init__(self):
        self._session: ClientSession | None = None
        self._stdio_context = None
        self._session_context = None
        self.service_account_path = os.environ.get(
            "SERVICE_ACCOUNT_PATH",
            os.path.join(os.path.dirname(__file__), "..", "..", "config", "service-account.json"),
        )

    async def connect(self):
        """Start MCP server and create client session."""
        server_params = StdioServerParameters(
            command="uvx",
            args=["mcp-google-sheets"],
            env={**os.environ, "SERVICE_ACCOUNT_PATH": self.service_account_path},
        )
        self._stdio_context = stdio_client(server_params)
        read, write = await self._stdio_context.__aenter__()
        self._session_context = ClientSession(read, write)
        self._session = await self._session_context.__aenter__()
        await self._session.initialize()

    async def disconnect(self):
        """Close MCP session."""
        if self._session_context:
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception:
                pass
        if self._stdio_context:
            try:
                await self._stdio_context.__aexit__(None, None, None)
            except Exception:
                pass
        self._session = None

    async def _call_tool(self, name: str, arguments: dict) -> dict:
        if not self._session:
            raise RuntimeError("SheetsService not connected")
        result = await self._session.call_tool(name, arguments)
        # MCP tool results come as content list; extract text
        if result.content and len(result.content) > 0:
            text = result.content[0].text
            try:
                return json.loads(text)
            except (json.JSONDecodeError, AttributeError):
                return {"raw": text}
        return {}

    async def list_sheets(self, spreadsheet_id: str) -> list[str]:
        result = await self._call_tool("list_sheets", {"spreadsheet_id": spreadsheet_id})
        return result.get("sheets", [])

    async def get_sheet_data(self, spreadsheet_id: str, sheet_name: str) -> SheetData | None:
        result = await self._call_tool("read_sheet", {
            "spreadsheet_id": spreadsheet_id,
            "sheet_name": sheet_name,
        })
        if not result or "raw" in result:
            return None

        headers = result.get("headers", [])
        raw_rows = result.get("rows", [])

        # Parse language headers: "English(en)" -> Language(code="en", label="English")
        languages = []
        for h in headers[1:]:  # skip 'key' column
            m = re.match(r"(.+)\((\w+)\)", h)
            if m:
                languages.append(Language(code=m.group(2), label=m.group(1), is_source=False))

        # First language is source by default
        if languages:
            languages[0].is_source = True

        # Convert rows to dicts
        rows = []
        for raw_row in raw_rows:
            row = {"key": raw_row[0] if raw_row else ""}
            for i, lang in enumerate(languages):
                row[lang.code] = raw_row[i + 1] if i + 1 < len(raw_row) else ""
            rows.append(row)

        return SheetData(
            sheet_name=sheet_name,
            headers=headers,
            languages=languages,
            rows=rows,
        )

    async def update_cells(self, spreadsheet_id: str, sheet_name: str, updates: list[dict]) -> bool:
        await self._call_tool("batch_update_cells", {
            "spreadsheet_id": spreadsheet_id,
            "sheet_name": sheet_name,
            "updates": updates,
        })
        return True
