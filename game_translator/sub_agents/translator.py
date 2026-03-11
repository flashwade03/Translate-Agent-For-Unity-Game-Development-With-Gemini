import os

from google.adk.agents import Agent
from ..prompts import TRANSLATOR_INSTRUCTION

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")


def create_translator_agent() -> Agent:
    return Agent(
        model=_MODEL,
        name="translator_agent",
        description="Translates game text to target languages using glossary and style guide context.",
        instruction=TRANSLATOR_INSTRUCTION,
    )

# ADK CLI 호환: 모듈 레벨 export 유지
translator_agent = create_translator_agent()
