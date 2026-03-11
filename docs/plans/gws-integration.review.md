---
document_file: docs/plans/gws-integration.md
mode: plan
revision: 3
reviewed_at: 2026-03-11 20:51
reviewers: [claude, openai]
verdict: APPROVED
---

# Forge Review - GWS Integration Implementation Plan

## Review History

| Iteration | Claude | Gemini | OpenAI | Verdict | Key Issues |
|-----------|--------|--------|--------|---------|------------|
| 1 | NEEDS_WORK | N/A | Critical issues | NEEDS_REVISION | SkillToolset unverified, main.py wiring missing, write detection hardcoded, DB path unresolved, error handling absent |
| 2 | MINOR_ISSUES | N/A | Critical issues | NEEDS_REVISION | gws_read_sheet not in tool list, ON CONFLICT syntax, JSON escaping, pending merge, WAL mode |

## Current Iteration (3)

### Claude Inspection

#### Scores
| Criterion | Score | Notes |
|-----------|-------|-------|
| Codebase Grounding | GOOD | References verified against real files and line numbers. ADK SkillToolset confirmed. |
| Clarity of Thinking | GOOD | All 5 previous critical issues addressed by name. Stream structure clear. |
| Completeness | ACCEPTABLE | Three minor gaps: `__init__.py` export as prose not task, `useProjects` hook updates unassigned, WAL for JobHistoryService "recommended" not "required" |
| Feasibility | ACCEPTABLE | Core approach sound. Unverified gws CLI flag (`@file`) is main runtime risk. |
| Testability | GOOD | Mock fixtures well-designed. Each stream maps to test files. |

**Verdict: MINOR_ISSUES**

All 5 critical fixes confirmed:
1. `gws_read_sheet` in tool list — FIXED
2. `ON CONFLICT ... WHERE` with partial unique index — FIXED (valid SQLite 3.35+)
3. Temp file for JSON payload — FIXED
4. Client-side pending merge strategy — FIXED
5. WAL mode in agent tool + backend service — FIXED

Remaining concerns:
- `--request.body=@{tmp_path}` gws CLI flag unverifiable from codebase (verify before starting Stream 2)
- `__init__.py` export of `create_agent` described in prose, not as explicit task step
- `useProjects` hook/mock data `sourceType` updates not assigned to task
- WAL for `JobHistoryService.init_db()` "recommended" but not required as task

### Gemini Inspection

_(Gemini review unavailable — API returned 400 Bad Request across all iterations)_

### OpenAI Inspection

**Verdict: MINOR_ISSUES**

Concerns (all non-blocking):
- WAL PRAGMA may need to be verified at startup with sync connection (but PendingTranslationsService.init_db sets it first)
- DB_PATH hardcoding fragile for non-root-directory deployments (out of v3 scope)
- Apply partial state if batchUpdate is not atomic (plan explicitly states batchUpdate IS atomic)
- Session service reuse between CSV/GWS runners (valid suggestion, implementer should note)
- SkillToolset discovery mechanism needs documentation
- Frontend error handling for apply mutation could be more specific
- Unit test coverage for error branches recommended

---

### Consolidated Summary

#### Resolved (from iteration 2)

All 5 critical issues are confirmed fixed:
1. `gws_read_sheet` registered in agent tool list
2. SQLite upsert uses valid partial unique index + `ON CONFLICT ... WHERE` (3.35+)
3. JSON payload written to temp file, avoiding shell escaping
4. Client-side merge strategy with `pendingOverrides` + `mergedRows` + diff display
5. WAL mode set in both agent tool and backend service

#### Remaining Suggestions (non-blocking)

1. Verify `gws` CLI interface before starting Stream 2 (`gws --help`, `--request.body=@file` syntax)
2. Add WAL to `JobHistoryService.init_db()` as explicit task step
3. Add `create_agent` export from `__init__.py` as numbered sub-step in task 1.2
4. Assign `useProjects` hook/mock data `sourceType` updates to task 4.1
5. Consider per-source-type Runner caching instead of fresh creation per job
6. Add unit tests for `_run_gws` error branches and frontend hooks
7. Feature-flag Stream 4 pending UI to avoid 404s when backend API not yet ready

---

### Verdict: APPROVED

The plan has converged after 3 iterations. All 12 critical issues raised across iterations 1-2 are resolved. Remaining items are implementation-level suggestions that do not require plan restructuring. The plan is ready for implementation via agent-teams.
