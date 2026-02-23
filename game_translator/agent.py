from google.adk.agents import Agent

from .sub_agents.translator import translator_agent
from .sub_agents.reviewer import reviewer_agent
from .tools.config import get_project_config, get_sheet_context
from .tools.glossary import get_glossary, get_style_guide
from .tools.sheets import read_sheet, write_sheet
from .prompts import ORCHESTRATOR_INSTRUCTION

root_agent = Agent(
    model="gemini-2.0-flash",
    name="game_translator",
    description="Game translation orchestrator. Reads CSV sheets, coordinates translation and review.",
    instruction=ORCHESTRATOR_INSTRUCTION,
    tools=[
        read_sheet,
        write_sheet,
        get_project_config,
        get_sheet_context,
        get_glossary,
        get_style_guide,
    ],
    sub_agents=[translator_agent, reviewer_agent],
)
