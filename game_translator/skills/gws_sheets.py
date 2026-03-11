from google.adk.skills.models import Skill, Frontmatter, Resources, Script
from google.adk.tools.skill_toolset import SkillToolset

GWS_SHEETS_SKILL_MD = """
## Google Sheets Read Operations

You can read data from Google Sheets using the `gws` CLI tool.

### List tabs in a spreadsheet
```bash
gws sheets spreadsheets.get --spreadsheetId="{spreadsheet_id}" --fields="sheets.properties.title"
```

### Read tab data (all values)
```bash
gws sheets spreadsheets.values.get --spreadsheetId="{spreadsheet_id}" --range="{tab_name}"
```

### Read specific range
```bash
gws sheets spreadsheets.values.get --spreadsheetId="{spreadsheet_id}" --range="{tab_name}!A1:Z1000"
```

## Important Constraints
- You may ONLY READ from Google Sheets. Never write directly.
- After translating, call `save_pending_translations` to store results for user review.
- Never call `gws sheets spreadsheets.values.update` or `batchUpdate`.
"""

def create_gws_skill_toolset() -> SkillToolset:
    """Create a SkillToolset with gws-sheets read-only skill."""
    skill = Skill(
        frontmatter=Frontmatter(
            name="gws-sheets",
            description="Read data from Google Sheets using gws CLI. Read-only access.",
            allowed_tools="bash",
        ),
        instructions=GWS_SHEETS_SKILL_MD,
        resources=Resources(
            scripts={
                "read_tab": Script(
                    src='gws sheets spreadsheets.values.get --spreadsheetId="$1" --range="$2"'
                ),
            }
        ),
    )
    return SkillToolset(skills=[skill])
