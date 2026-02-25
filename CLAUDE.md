# Game Translation Agent

Google ADK(Gemini) 기반 멀티 에이전트 게임 번역 시스템. 로컬 CSV 파일 기반, React 대시보드 + FastAPI 백엔드.

## Tech Stack

- **Backend**: Python 3.11+, Google ADK, Gemini, FastAPI, PyYAML
- **Frontend**: React 18+ (TypeScript), Vite, TanStack Query, Tailwind CSS
- **CLI**: Click or Typer
- **Sheet Storage**: 로컬 CSV 파일 (`projects/<name>/sheets/*.csv`)

## Architecture

3 에이전트(ADK) + FastAPI + React. 상세는 설계 문서 참조.

## Project Structure

- `game_translator/` - ADK 에이전트 패키지 (`__init__.py`에서 `root_agent` export)
- `game_translator/sub_agents/` - translator.py, reviewer.py
- `game_translator/tools/` - sheets.py (CSV 읽기/쓰기), config.py, glossary.py
- `backend/` - FastAPI 서버 (routers/, services/)
- `frontend/` - React 앱 (pages/, components/)
- `cli.py` - CLI 엔트리포인트
- `projects/<name>/` - 프로젝트별 설정/용어집/스타일가이드 (YAML) + 시트 데이터 (CSV)
- `projects/<name>/sheets/` - CSV 파일 (시트당 1파일, 예: UI.csv, Dialogues.csv)

## Commands

```bash
# Backend
uvicorn backend.main:app --reload

# Frontend
cd frontend && npm run dev

# CLI
python cli.py translate --project "opal_app" --sheet "UI"
python cli.py update --project "opal_app" --keys "key1,key2"
python cli.py review --project "opal_app" --sheet "UI"

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
- CSV 헤더에서 언어 코드 자동 감지 (예: `Japanese(ja)` -> `ja`, `Chinese (Simplified)(zh-Hans)` -> `zh-Hans`). locale 코드에 하이픈 포함 가능.
- `.env`에 `GOOGLE_API_KEY` 필요 (Gemini API용)
- CSV 파일은 `projects/<name>/sheets/` 디렉토리에 배치. 시트 수는 CSV 파일 개수에서 동적 산출.

## Design Docs

설계 결정은 docs/feature/에 있다. 구현 시 해당 영역의 문서를 먼저 읽고 결정 사항을 따를 것.

| 문서 | 참조 시점 |
|------|----------|
| `docs/feature/agent-design.md` | 에이전트 구조, CSV 도구, 번역 워크플로우, 제약 조건 확인 시 |
| `docs/feature/backend-design.md` | API 설계, CSV 시트 관리, 행(key) CRUD, 시트 설정, 비동기 job 모델, Runner/SessionService, 데이터 흐름, Unity CSV 포맷, 프로젝트 언어 관리, 용어집 데이터 모델, 테스트 전략 확인 시. v1: WebSocket 진행률, Job SQLite 영속화 |
| `docs/feature/frontend-design.md` | 화면 구성, 레이아웃, UX 결정, 언어 설정 화면, locale 프리셋, 소스 언어 dropdown, 용어집 데이터 구조 확인 시. v1: WebSocket 수신, Job History 화면 |
