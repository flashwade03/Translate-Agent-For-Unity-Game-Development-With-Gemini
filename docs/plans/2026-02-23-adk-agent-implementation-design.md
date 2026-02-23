# ADK Agent Implementation Design

## Context

`docs/feature/agent-design.md`의 고수준 설계를 기반으로, Google ADK + MCP Google Sheets 서버를 사용한 구현 설계.

## Key Decision: MCP for Google Sheets

Google Sheets API를 직접 구현하지 않고 `mcp-google-sheets` MCP 서버를 ADK의 `McpToolset`으로 연결한다.

**Why:** 19개 Sheets 도구가 이미 구현되어 있고, ADK가 MCP 클라이언트를 네이티브 지원하므로 별도 sheets.py 불필요.

## Package Structure

```
game_translator/
├── __init__.py          # from .agent import root_agent
├── agent.py             # Orchestrator (root_agent)
├── sub_agents/
│   ├── __init__.py
│   ├── translator.py    # Translator agent
│   └── reviewer.py      # Reviewer agent
├── tools/
│   ├── __init__.py
│   ├── glossary.py      # get_glossary, get_style_guide
│   └── config.py        # get_project_config, get_sheet_context
└── prompts.py           # instruction templates
```

## Agent Definitions

### Orchestrator (root_agent)
- Model: gemini-2.0-flash
- Tools: MCP Sheets (McpToolset), get_glossary, get_style_guide, get_sheet_context, get_project_config
- Sub-agents: Translator, Reviewer
- Instruction: 사용자 요청 해석, 시트 읽기, 컨텍스트 수집, 하위 에이전트 위임, 결과 시트 쓰기

### Translator (sub_agent)
- Model: gemini-2.0-flash
- Tools: 없음 (Orchestrator가 데이터를 제공)
- Instruction: 용어집/스타일가이드/시트컨텍스트를 참조하여 번역. 플레이스홀더 보존. JSON 형식 응답.

### Reviewer (sub_agent)
- Model: gemini-2.0-flash
- Tools: 없음
- Instruction: 번역 품질 검수. 플레이스홀더 보존, 용어집 준수, 톤 일관성 확인. JSON 형식 리포트.

## MCP Connection

```python
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

sheets_toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="uvx",
            args=["mcp-google-sheets"],
            env={"SERVICE_ACCOUNT_PATH": "config/service-account.json"},
        ),
        timeout=30,
    ),
)
```

## Project Config (YAML)

```
projects/<project_id>/
├── config.yaml         # spreadsheet_id, default_source_language
├── glossary.yaml       # [{source, target, language, context?}]
├── style_guide.yaml    # tone, formality, audience, rules, examples
└── sheets/
    └── <SheetName>.yaml  # source_language, translation_style, character_limit, glossary_override, instructions
```

## Constraints (from design doc)

- 플레이스홀더 ({0}, {1}, {player_name}) 원본 보존
- 소스 언어 컬럼 수정 금지
- 헤더에서 언어 코드 자동 감지 (Japanese(ja) → ja)
- Sheets API는 MCP 서버 경유 (에이전트 직접 접근 금지)
