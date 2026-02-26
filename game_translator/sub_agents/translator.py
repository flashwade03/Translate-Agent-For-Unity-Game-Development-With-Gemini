import os

from google.adk.agents import Agent
from ..prompts import TRANSLATOR_INSTRUCTION

translator_agent = Agent(
    model=os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview"),
    name="translator_agent",
    description="Translates game text to target languages using glossary and style guide context.",
    instruction=TRANSLATOR_INSTRUCTION,
)
