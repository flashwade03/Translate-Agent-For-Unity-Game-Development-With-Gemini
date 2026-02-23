from google.adk.agents import Agent
from ..prompts import TRANSLATOR_INSTRUCTION

translator_agent = Agent(
    model="gemini-2.0-flash",
    name="translator_agent",
    description="Translates game text to target languages using glossary and style guide context.",
    instruction=TRANSLATOR_INSTRUCTION,
)
