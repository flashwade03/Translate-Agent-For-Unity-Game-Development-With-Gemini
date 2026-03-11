import os

from google.adk.agents import Agent
from ..prompts import REVIEWER_INSTRUCTION

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")


def create_reviewer_agent() -> Agent:
    return Agent(
        model=_MODEL,
        name="reviewer_agent",
        description="Reviews translated game text for quality issues including accuracy, terminology, style, and placeholder preservation.",
        instruction=REVIEWER_INSTRUCTION,
    )

# ADK CLI 호환: 모듈 레벨 export 유지
reviewer_agent = create_reviewer_agent()
