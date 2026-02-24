"""CLI for the Game Translation Agent."""

import asyncio
import sys

import click
from dotenv import load_dotenv

load_dotenv()


async def _run_agent(project_id: str, sheet_name: str, job_type: str, keys: str | None = None):
    """Run the ADK agent for a translation/review task."""
    from google.adk.runners import Runner
    from google.adk.sessions import DatabaseSessionService
    from google.genai import types
    from game_translator import root_agent

    session_service = DatabaseSessionService(db_url="sqlite+aiosqlite:///./sessions.db")
    runner = Runner(
        agent=root_agent,
        session_service=session_service,
        app_name="game_translator",
    )

    session = await session_service.create_session(
        app_name="game_translator",
        user_id=project_id,
    )

    if job_type == "translate":
        msg = f"Translate the {sheet_name} sheet for the {project_id} project. Translate all keys to all target languages. You MUST call write_sheet to save results."
    elif job_type == "update":
        key_list = keys or ""
        msg = f"Update translations for keys [{key_list}] in the {sheet_name} sheet of the {project_id} project. You MUST call write_sheet to save results."
    elif job_type == "review":
        msg = f"Review the translations in the {sheet_name} sheet for the {project_id} project. Return a JSON report with issues."
    else:
        click.echo(f"Unknown job type: {job_type}", err=True)
        return

    click.echo(f"Running {job_type} on {project_id}/{sheet_name}...")

    content = types.Content(
        role="user",
        parts=[types.Part(text=msg)],
    )

    wrote_sheet = False
    response_text = ""

    async for event in runner.run_async(
        session_id=session.id,
        user_id=project_id,
        new_message=content,
    ):
        if getattr(event, "content", None) and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    click.echo(f"  -> {part.function_call.name}()", err=True)
                    if part.function_call.name == "write_sheet":
                        wrote_sheet = True
                elif hasattr(part, "text") and part.text:
                    response_text += part.text

    # Follow-up if write_sheet wasn't called
    if not wrote_sheet and job_type in ("translate", "update"):
        click.echo("  -> nudging agent to call write_sheet...", err=True)
        followup = types.Content(
            role="user",
            parts=[types.Part(text=(
                "You have the translations ready. Now call "
                "write_sheet(project_id, sheet_name, updates) to save them. "
                "Each update needs 'key', 'lang_code', and 'value'."
            ))],
        )
        async for event in runner.run_async(
            session_id=session.id,
            user_id=project_id,
            new_message=followup,
        ):
            if getattr(event, "content", None) and event.content.parts:
                for part in event.content.parts:
                    if hasattr(part, "function_call") and part.function_call:
                        click.echo(f"  -> {part.function_call.name}()", err=True)
                    elif hasattr(part, "text") and part.text:
                        response_text += part.text

    if job_type == "review":
        click.echo("\n--- Review Report ---")
        click.echo(response_text)
    else:
        click.echo("Done.")


@click.group()
def cli():
    """Game Translation Agent CLI."""
    pass


@cli.command()
@click.option("--project", required=True, help="Project ID (directory name under projects/)")
@click.option("--sheet", required=True, help="Sheet name (CSV filename without extension)")
def translate(project: str, sheet: str):
    """Translate all empty cells in a sheet to all target languages."""
    asyncio.run(_run_agent(project, sheet, "translate"))


@cli.command()
@click.option("--project", required=True, help="Project ID")
@click.option("--sheet", required=True, help="Sheet name")
@click.option("--keys", required=True, help="Comma-separated keys to update")
def update(project: str, sheet: str, keys: str):
    """Re-translate specific keys in a sheet."""
    asyncio.run(_run_agent(project, sheet, "update", keys=keys))


@cli.command()
@click.option("--project", required=True, help="Project ID")
@click.option("--sheet", required=True, help="Sheet name")
def review(project: str, sheet: str):
    """Review translations and output a quality report."""
    asyncio.run(_run_agent(project, sheet, "review"))


if __name__ == "__main__":
    cli()
