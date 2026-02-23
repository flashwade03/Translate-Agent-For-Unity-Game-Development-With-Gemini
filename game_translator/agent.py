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
