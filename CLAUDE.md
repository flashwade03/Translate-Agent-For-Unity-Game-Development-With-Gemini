# Game Translation Agent

Google ADK(Gemini) 기반 멀티 에이전트 게임 번역 시스템. Google Spreadsheet 연동, React 대시보드 + FastAPI 백엔드.

## Tech Stack

- **Backend**: Python 3.11+, Google ADK, Gemini, FastAPI, Google Sheets API v4, PyYAML
- **Frontend**: React 18+ (TypeScript), Vite, TanStack Query, Tailwind CSS
- **CLI**: Click or Typer

## Architecture

3 에이전트(ADK) + FastAPI + React. 상세는 설계 문서 참조.

## Project Structure

- `game_translator/` - ADK 에이전트 패키지 (`__init__.py`에서 `root_agent` export)
- `game_translator/sub_agents/` - translator.py, reviewer.py
- `game_translator/tools/` - config.py, glossary.py (MCP Google Sheets는 McpToolset으로 연결)
- `backend/` - FastAPI 서버 (routers/, services/)
- `frontend/` - React 앱 (pages/, components/)
- `cli.py` - CLI 엔트리포인트
- `projects/<name>/` - 프로젝트별 설정/용어집/스타일가이드 (YAML)

## Commands

```bash
# Backend
uvicorn backend.main:app --reload

# Frontend
cd frontend && npm run dev

# CLI
python cli.py translate --project "opal_app" --sheet "Sheet1"
python cli.py update --project "opal_app" --keys "key1,key2"
python cli.py review --project "opal_app" --sheet "Sheet1"

# ADK
adk web
adk run game_translator
```

## Code Conventions

- ADK 도구 함수: 반드시 type hint + docstring 포함 (Gemini가 도구 설명으로 사용)
- ADK 패키지: `__init__.py`에서 반드시 `root_agent` export
- FastAPI 라우터: `backend/routers/`에 도메인별 분리
- React: TypeScript strict, 페이지는 `pages/`, 공통 컴포넌트는 `components/`

## Gotchas

- 플레이스홀더 (`{0}`, `{1}`) 번역 시 반드시 원본 그대로 보존
- 기준 언어가 유동적 (영어 외 다른 언어도 원문 가능)
- 스프레드시트 헤더에서 언어 코드 자동 감지 (예: `Japanese(ja)` -> `ja`)
- `.env`에 `GOOGLE_API_KEY` 필요, 서비스 계정 JSON은 `config/` 하위에 배치
- Google Sheets API 쿼터 주의: batch read/write 사용 권장

## Design Docs

설계 결정은 docs/feature/에 있다. 구현 시 해당 영역의 문서를 먼저 읽고 결정 사항을 따를 것.

| 문서 | 참조 시점 |
|------|----------|
| `docs/feature/agent-design.md` | 에이전트 구조, MCP 연동, 번역 워크플로우(시퀀스), 제약 조건 확인 시 |
| `docs/feature/backend-design.md` | API 설계, 비동기 job 모델(상태 다이어그램), Runner/SessionService(SQLite), 데이터 흐름(시퀀스) 확인 시 |
| `docs/feature/frontend-design.md` | 화면 구성, 레이아웃, UX 결정 확인 시 |
