import os

from google.adk.agents import Agent

from .sub_agents.translator import translator_agent
from .sub_agents.reviewer import reviewer_agent
from .tools.config import get_project_config, get_sheet_context
from .tools.glossary import get_glossary, get_style_guide
from .tools.sheets import read_sheet, write_sheet
from .prompts import ORCHESTRATOR_INSTRUCTION, ORCHESTRATOR_INSTRUCTION_GWS

_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")


def create_agent(source_type: str = "csv") -> Agent:
    """source_type에 따라 적절한 도구/스킬이 장착된 에이전트를 생성한다."""
    if source_type == "gws":
        from .skills.gws_sheets import create_gws_skill_toolset
        from .tools.pending import save_pending_translations
        from .tools.gws_read import gws_read_sheet
        tools = [
            get_project_config,
            get_sheet_context,
            get_glossary,
            get_style_guide,
            gws_read_sheet,              # Google Sheets 읽기 래퍼 도구
            save_pending_translations,    # 번역 결과 pending 저장
            create_gws_skill_toolset(),   # SkillToolset (gws CLI 참조 지시사항)
        ]
        instruction = ORCHESTRATOR_INSTRUCTION_GWS
    else:
        tools = [
            read_sheet, write_sheet,
            get_project_config, get_sheet_context,
            get_glossary, get_style_guide,
        ]
        instruction = ORCHESTRATOR_INSTRUCTION

    return Agent(
        model=_MODEL,
        name="game_translator",
        description="Game translation orchestrator.",
        instruction=instruction,
        tools=tools,
        sub_agents=[translator_agent, reviewer_agent],
    )

# ADK CLI 호환: 모듈 레벨 export 유지
root_agent = create_agent("csv")
