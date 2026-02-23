# ADK Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Google ADK 기반 멀티 에이전트 게임 번역 시스템 구현 (Orchestrator + Translator + Reviewer), MCP Google Sheets 연동.

**Architecture:** Orchestrator(root_agent)가 MCP로 시트를 읽고, YAML에서 용어집/스타일가이드를 로드한 뒤, Translator 또는 Reviewer 서브에이전트에게 위임. 번역 결과는 Orchestrator가 MCP로 시트에 쓰기.

**Tech Stack:** Python 3.11+, Google ADK, Gemini 2.0 Flash, mcp-google-sheets, PyYAML

---

### Task 1: Python Project Setup

**Files:**
- Create: `pyproject.toml`
- Create: `requirements.txt`
- Create: `.env.example`

**Step 1: Create pyproject.toml**

```toml
[project]
name = "game-translator"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "google-adk>=1.0.0",
    "mcp",
    "pyyaml>=6.0",
    "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
]
```

**Step 2: Create requirements.txt**

```
google-adk>=1.0.0
mcp
pyyaml>=6.0
python-dotenv>=1.0
```

**Step 3: Create .env.example**

```bash
GOOGLE_API_KEY=your_gemini_api_key_here
SERVICE_ACCOUNT_PATH=config/service-account.json
```

**Step 4: Install dependencies**

Run: `pip install -e ".[dev]"`
Expected: All packages install successfully.

**Step 5: Verify ADK is available**

Run: `python -c "from google.adk.agents import Agent; print('ADK OK')"`
Expected: `ADK OK`

---

### Task 2: Sample Project Config (YAML)

**Files:**
- Create: `projects/opal_app/config.yaml`
- Create: `projects/opal_app/glossary.yaml`
- Create: `projects/opal_app/style_guide.yaml`
- Create: `projects/opal_app/sheets/UI.yaml`

**Step 1: Create project config**

`projects/opal_app/config.yaml`:
```yaml
spreadsheet_id: "1abc123_example"
default_source_language: "en"
```

**Step 2: Create glossary**

`projects/opal_app/glossary.yaml`:
```yaml
entries:
  - source: "Level Up"
    target: "レベルアップ"
    language: "ja"
    context: "Game progression"
  - source: "Level Up"
    target: "레벨업"
    language: "ko"
    context: "Game progression"
  - source: "Score"
    target: "スコア"
    language: "ja"
    context: "Points display"
  - source: "Score"
    target: "점수"
    language: "ko"
    context: "Points display"
```

**Step 3: Create style guide**

`projects/opal_app/style_guide.yaml`:
```yaml
tone: "Friendly and encouraging"
formality: "casual"
audience: "Young adults (18-30)"
rules: |
  - Use simple, clear language
  - Keep exclamations for achievements
  - Avoid jargon
examples: |
  Good: "Awesome job!"
  Bad: "Your performance metrics have been satisfactory."
```

**Step 4: Create sheet context override**

`projects/opal_app/sheets/UI.yaml`:
```yaml
source_language: "en"
translation_style: "casual"
character_limit: 30
glossary_override: false
instructions: "Keep UI strings short and punchy."
```

---

### Task 3: Tool Functions — Config Loader

**Files:**
- Create: `game_translator/__init__.py` (empty placeholder)
- Create: `game_translator/tools/__init__.py`
- Create: `game_translator/tools/config.py`
- Create: `tests/test_config.py`

**Step 1: Write failing tests**

`tests/test_config.py`:
```python
import pytest
from game_translator.tools.config import get_project_config, get_sheet_context


def test_get_project_config_returns_dict():
    result = get_project_config(project_id="opal_app")
    assert isinstance(result, dict)
    assert "spreadsheet_id" in result
    assert "default_source_language" in result


def test_get_project_config_missing_project():
    result = get_project_config(project_id="nonexistent")
    assert "error" in result


def test_get_sheet_context_returns_dict():
    result = get_sheet_context(project_id="opal_app", sheet_name="UI")
    assert isinstance(result, dict)
    assert "source_language" in result


def test_get_sheet_context_missing_returns_defaults():
    result = get_sheet_context(project_id="opal_app", sheet_name="NonExistent")
    assert isinstance(result, dict)
    assert "source_language" in result
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_config.py -v`
Expected: FAIL (module not found)

**Step 3: Implement config.py**

`game_translator/tools/config.py`:
```python
import os
import yaml
from pathlib import Path

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


def get_project_config(project_id: str) -> dict:
    """Load project configuration from YAML.

    Args:
        project_id: The project identifier (directory name under projects/).

    Returns:
        Dictionary with spreadsheet_id and default_source_language,
        or dict with 'error' key if project not found.
    """
    config_path = PROJECTS_DIR / project_id / "config.yaml"
    if not config_path.exists():
        return {"error": f"Project '{project_id}' not found at {config_path}"}
    with open(config_path) as f:
        return yaml.safe_load(f)


def get_sheet_context(project_id: str, sheet_name: str) -> dict:
    """Load sheet-specific context overrides from YAML.

    Args:
        project_id: The project identifier.
        sheet_name: The sheet name (used to find <sheet_name>.yaml).

    Returns:
        Dictionary with source_language, translation_style, character_limit,
        glossary_override, and instructions. Returns defaults if file missing.
    """
    defaults = {
        "source_language": "en",
        "translation_style": "casual",
        "character_limit": None,
        "glossary_override": False,
        "instructions": "",
    }
    sheet_path = PROJECTS_DIR / project_id / "sheets" / f"{sheet_name}.yaml"
    if not sheet_path.exists():
        return defaults
    with open(sheet_path) as f:
        data = yaml.safe_load(f) or {}
    return {**defaults, **data}
```

`game_translator/__init__.py`:
```python
# Placeholder — root_agent will be exported after agent.py is created
```

`game_translator/tools/__init__.py`:
```python
```

**Step 4: Run tests to verify they pass**

Run: `pytest tests/test_config.py -v`
Expected: All 4 tests PASS

---

### Task 4: Tool Functions — Glossary & Style Guide

**Files:**
- Create: `game_translator/tools/glossary.py`
- Create: `tests/test_glossary.py`

**Step 1: Write failing tests**

`tests/test_glossary.py`:
```python
from game_translator.tools.glossary import get_glossary, get_style_guide


def test_get_glossary_returns_entries():
    result = get_glossary(project_id="opal_app")
    assert isinstance(result, dict)
    assert "entries" in result
    assert len(result["entries"]) > 0


def test_get_glossary_filter_by_language():
    result = get_glossary(project_id="opal_app", language="ja")
    assert all(e["language"] == "ja" for e in result["entries"])


def test_get_glossary_missing_project():
    result = get_glossary(project_id="nonexistent")
    assert "entries" in result
    assert len(result["entries"]) == 0


def test_get_style_guide_returns_dict():
    result = get_style_guide(project_id="opal_app")
    assert "tone" in result
    assert "formality" in result
    assert "rules" in result


def test_get_style_guide_missing_project():
    result = get_style_guide(project_id="nonexistent")
    assert "tone" in result  # returns defaults
```

**Step 2: Run tests to verify they fail**

Run: `pytest tests/test_glossary.py -v`
Expected: FAIL

**Step 3: Implement glossary.py**

`game_translator/tools/glossary.py`:
```python
import yaml
from pathlib import Path

PROJECTS_DIR = Path(__file__).parent.parent.parent / "projects"


def get_glossary(project_id: str, language: str = "") -> dict:
    """Load project glossary from YAML, optionally filtered by language.

    Args:
        project_id: The project identifier.
        language: If provided, filter entries to this language code (e.g. 'ja').

    Returns:
        Dictionary with 'entries' list. Each entry has source, target, language, context.
        Returns empty entries list if glossary file not found.
    """
    glossary_path = PROJECTS_DIR / project_id / "glossary.yaml"
    if not glossary_path.exists():
        return {"entries": []}
    with open(glossary_path) as f:
        data = yaml.safe_load(f) or {}
    entries = data.get("entries", [])
    if language:
        entries = [e for e in entries if e.get("language") == language]
    return {"entries": entries}


def get_style_guide(project_id: str) -> dict:
    """Load project style guide from YAML.

    Args:
        project_id: The project identifier.

    Returns:
        Dictionary with tone, formality, audience, rules, examples.
        Returns defaults if file not found.
    """
    defaults = {
        "tone": "",
        "formality": "neutral",
        "audience": "",
        "rules": "",
        "examples": "",
    }
    guide_path = PROJECTS_DIR / project_id / "style_guide.yaml"
    if not guide_path.exists():
        return defaults
    with open(guide_path) as f:
        data = yaml.safe_load(f) or {}
    return {**defaults, **data}
```

**Step 4: Run tests**

Run: `pytest tests/test_glossary.py -v`
Expected: All 5 tests PASS

---

### Task 5: Prompt Templates

**Files:**
- Create: `game_translator/prompts.py`

**Step 1: Create prompt templates**

`game_translator/prompts.py` — contains the instruction strings for each agent. These are long, so they live in a dedicated file.

```python
ORCHESTRATOR_INSTRUCTION = """You are the Orchestrator for a game translation system. You coordinate translation and review tasks.

## Your Responsibilities
1. Parse the user's request to determine the action: translate, update specific keys, or review.
2. Use tools to read the spreadsheet data and load project configuration.
3. Delegate translation work to the Translator agent and review work to the Reviewer agent.
4. Write translation results back to the spreadsheet.

## Workflow: Translate
1. Call get_project_config to get the spreadsheet_id.
2. Call get_sheet_data via MCP to read the sheet.
3. Parse headers to detect languages. Headers follow the pattern: "LanguageName(code)" e.g. "Japanese(ja)".
4. Call get_sheet_context to get sheet-specific overrides (source language, style, character limit, instructions).
5. Call get_glossary and get_style_guide to load translation context.
6. For each target language, delegate to the Translator agent with all context.
7. Call update_cells or batch_update_cells via MCP to write results back.

## Workflow: Update (specific keys only)
Same as Translate, but only process the keys specified by the user.

## Workflow: Review
1. Read sheet data and context (same as translate steps 1-5).
2. Delegate to the Reviewer agent with all data.
3. Return the review report to the user.

## Language Detection
Parse spreadsheet headers to extract language codes:
- "English(en)" → code: "en", label: "English"
- "Japanese(ja)" → code: "ja", label: "Japanese"
- "Korean(ko)" → code: "ko", label: "Korean"
The source language is determined by the sheet context (get_sheet_context) or project config default.

## Rules
- NEVER modify the source language column.
- Always use batch operations for efficiency.
- Report progress to the user after each major step.
"""

TRANSLATOR_INSTRUCTION = """You are a game Translator agent. You translate game text according to the provided context.

## Input
You receive:
- Source text (key-value pairs in the source language)
- Target language code and name
- Glossary entries relevant to the target language
- Style guide (tone, formality, audience, rules)
- Sheet context (translation style, character limit, additional instructions)

## Rules
1. **Placeholders**: Preserve ALL placeholders exactly as-is. Placeholders look like: {0}, {1}, {player_name}, %s, %d, {{variable}}, etc.
2. **Glossary**: Use glossary terms when they match. Glossary has priority over your own word choice.
3. **Style**: Follow the style guide's tone and formality level.
4. **Character Limit**: If a character limit is set, keep translations within that limit.
5. **Context**: Consider the sheet-specific instructions for domain context (UI text vs dialogue vs items).
6. **Consistency**: Use consistent terminology across all keys in the same batch.

## Output Format
Respond with a JSON object mapping keys to translated values:
```json
{
  "btn_start": "ゲームスタート",
  "btn_settings": "設定",
  "msg_welcome": "ようこそ、{0}！"
}
```

Only include the keys you were asked to translate. Do not include source language text.
"""

REVIEWER_INSTRUCTION = """You are a game translation Reviewer agent. You check translation quality.

## Input
You receive:
- Original source text (key-value pairs)
- Translated text for one or more target languages
- Glossary entries
- Style guide
- Sheet context

## Check Categories
1. **accuracy**: Is the meaning preserved? Are there missing translations (empty cells)?
2. **fluency**: Is the translation natural in the target language?
3. **terminology**: Are glossary terms used correctly and consistently?
4. **style**: Does the tone match the style guide?
5. **placeholder**: Are all placeholders preserved exactly?
6. **length**: Does the translation exceed any character limit?

## Severity Levels
- **error**: Must fix. Missing translations, broken placeholders, wrong meaning.
- **warning**: Should fix. Inconsistent terminology, wrong tone.
- **info**: Consider fixing. Minor style suggestions, alternative word choices.

## Output Format
Respond with a JSON object:
```json
{
  "issues": [
    {
      "key": "msg_level_up",
      "language": "ja",
      "severity": "warning",
      "category": "style",
      "message": "Translation uses formal tone, but style guide specifies casual.",
      "suggestion": "レベルアップ！レベル{0}になったよ！",
      "original": "Level Up! You reached level {0}",
      "translated": "レベルアップ！レベル{0}に到達"
    }
  ]
}
```
"""
```

---

### Task 6: Sub-Agent — Translator

**Files:**
- Create: `game_translator/sub_agents/__init__.py`
- Create: `game_translator/sub_agents/translator.py`

**Step 1: Create translator agent**

`game_translator/sub_agents/__init__.py`:
```python
```

`game_translator/sub_agents/translator.py`:
```python
from google.adk.agents import Agent
from ..prompts import TRANSLATOR_INSTRUCTION

translator_agent = Agent(
    model="gemini-2.0-flash",
    name="translator_agent",
    description="Translates game text to target languages using glossary and style guide context.",
    instruction=TRANSLATOR_INSTRUCTION,
)
```

**Step 2: Verify import**

Run: `python -c "from game_translator.sub_agents.translator import translator_agent; print(translator_agent.name)"`
Expected: `translator_agent`

---

### Task 7: Sub-Agent — Reviewer

**Files:**
- Create: `game_translator/sub_agents/reviewer.py`

**Step 1: Create reviewer agent**

`game_translator/sub_agents/reviewer.py`:
```python
from google.adk.agents import Agent
from ..prompts import REVIEWER_INSTRUCTION

reviewer_agent = Agent(
    model="gemini-2.0-flash",
    name="reviewer_agent",
    description="Reviews translated game text for quality issues including accuracy, terminology, style, and placeholder preservation.",
    instruction=REVIEWER_INSTRUCTION,
)
```

**Step 2: Verify import**

Run: `python -c "from game_translator.sub_agents.reviewer import reviewer_agent; print(reviewer_agent.name)"`
Expected: `reviewer_agent`

---

### Task 8: Root Agent — Orchestrator with MCP

**Files:**
- Create: `game_translator/agent.py`
- Modify: `game_translator/__init__.py`

**Step 1: Create the root agent**

`game_translator/agent.py`:
```python
import os
from google.adk.agents import Agent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

from .sub_agents.translator import translator_agent
from .sub_agents.reviewer import reviewer_agent
from .tools.config import get_project_config, get_sheet_context
from .tools.glossary import get_glossary, get_style_guide
from .prompts import ORCHESTRATOR_INSTRUCTION

service_account_path = os.environ.get(
    "SERVICE_ACCOUNT_PATH",
    os.path.join(os.path.dirname(__file__), "..", "config", "service-account.json"),
)

sheets_toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command="uvx",
            args=["mcp-google-sheets"],
            env={
                **os.environ,
                "SERVICE_ACCOUNT_PATH": service_account_path,
            },
        ),
        timeout=30,
    ),
)

root_agent = Agent(
    model="gemini-2.0-flash",
    name="game_translator",
    description="Game translation orchestrator. Reads spreadsheets, coordinates translation and review.",
    instruction=ORCHESTRATOR_INSTRUCTION,
    tools=[
        sheets_toolset,
        get_project_config,
        get_sheet_context,
        get_glossary,
        get_style_guide,
    ],
    sub_agents=[translator_agent, reviewer_agent],
)
```

**Step 2: Update __init__.py to export root_agent**

`game_translator/__init__.py`:
```python
from .agent import root_agent
```

**Step 3: Verify the package loads**

Run: `python -c "from game_translator import root_agent; print(root_agent.name, '- sub_agents:', [a.name for a in root_agent.sub_agents])"`
Expected: `game_translator - sub_agents: ['translator_agent', 'reviewer_agent']`

---

### Task 9: Integration Verification

**Step 1: Set environment variables**

Create `.env` file from `.env.example` with actual `GOOGLE_API_KEY`.

**Step 2: Run with ADK CLI**

Run: `adk run game_translator`
Input: "What tools do you have available?"
Expected: Agent lists MCP Sheets tools + custom tools (get_project_config, get_glossary, etc.)

**Step 3: Run ADK Web UI**

Run: `adk web`
Navigate to `http://localhost:8000` in browser.
Select `game_translator` agent.
Test: "Load the project config for opal_app"
Expected: Agent calls get_project_config and returns the YAML config contents.

**Step 4: Test translation flow (requires real spreadsheet)**

Input: "Translate the UI sheet for the opal_app project"
Expected: Agent orchestrates the full workflow — reads sheet, loads context, delegates to translator, writes results.

---

### Task 10: Run All Tests

**Step 1: Run full test suite**

Run: `pytest tests/ -v`
Expected: All tests pass.

**Step 2: Type check (optional)**

Run: `python -m py_compile game_translator/agent.py && echo "OK"`
Expected: `OK`
