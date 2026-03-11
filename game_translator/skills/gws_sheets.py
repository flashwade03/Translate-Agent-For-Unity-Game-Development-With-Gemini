from google.adk.skills.models import Skill, Frontmatter
from google.adk.tools.skill_toolset import SkillToolset

GWS_SHEETS_SKILL_MD = """\
## Google Sheets Read Operations

Use the `gws_read_sheet` tool to read data from Google Sheets.
Pass the spreadsheet_id and tab_name to get all rows and columns.

## Important Constraints
- You may ONLY READ from Google Sheets. Never write directly.
- After translating, call `save_pending_translations` to store results for user review.
- The user will apply pending translations to Google Sheets manually.
"""


def create_gws_skill_toolset() -> SkillToolset:
    """Create a SkillToolset with gws-sheets read-only skill."""
    skill = Skill(
        frontmatter=Frontmatter(
            name="gws-sheets",
            description="Read data from Google Sheets. Read-only access.",
        ),
        instructions=GWS_SHEETS_SKILL_MD,
    )
    return SkillToolset(skills=[skill])
