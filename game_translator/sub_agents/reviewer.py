import os

from google.adk.agents import Agent
from ..prompts import REVIEWER_INSTRUCTION

reviewer_agent = Agent(
    model=os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview"),
    name="reviewer_agent",
    description="Reviews translated game text for quality issues including accuracy, terminology, style, and placeholder preservation.",
    instruction=REVIEWER_INSTRUCTION,
)
