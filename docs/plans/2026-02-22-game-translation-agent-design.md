# Game Translation Agent - Design Document

## Overview

Google ADK(Gemini) 기반 멀티 에이전트 시스템으로, Google Spreadsheet에 저장된 게임 텍스트 테이블의 다국어 번역을 자동화한다. React 웹 대시보드와 FastAPI 백엔드를 통해 프로젝트 관리, 번역 실행, 검수 리포트 확인 등을 제공한다.

## Requirements

- Google ADK + Gemini LLM 사용
- CLI 로컬 실행 + 웹 대시보드
- 다중 스프레드시트 지원 (여러 게임 프로젝트)
- 기준 언어 유동적 (영어 외 다른 언어도 원문 가능)
- 스프레드시트 헤더의 전체 언어 자동 번역
- 용어집/스타일 가이드 프로젝트별 관리
- 웹에서 용어집/스타일 가이드 편집 가능

## Core Features

1. **translate** - 빈 셀 탐지 후 자동 번역
2. **update** - 원문 수정 시 해당 키의 모든 언어 재번역
3. **review** - 전체 번역 품질 검수 및 리포트 생성

## Architecture

### System Architecture

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React App   │────▶│  FastAPI     │────▶│  Google ADK     │
│  (Dashboard) │◀────│  (REST API)  │◀────│  (Agents)       │
└──────────────┘     └──────┬───────┘     └────────┬────────┘
                            │                      │
                     ┌──────▼───────┐      ┌───────▼────────┐
                     │  Projects DB │      │ Google Sheets  │
                     │  (YAML/SQLite)│      │    API         │
                     └──────────────┘      └────────────────┘
```

### Agent Structure (3 Agents + Shared Tools)

```
┌─────────────────────────────────────┐
│         Orchestrator Agent          │
│   (사용자 명령 해석, 작업 분배)       │
└──────────┬──────────────────────────┘
           │                │
    ┌──────▼──┐      ┌──────▼─────┐
    │Translator│      │  Reviewer  │
    │ Agent    │      │  Agent     │
    └────┬─────┘      └─────┬──────┘
         │                  │
    ┌────▼──────────────────▼──────┐
    │        Shared Tools          │
    │ - read_sheet (시트 읽기)      │
    │ - write_sheet (시트 쓰기)     │
    │ - get_glossary (용어집 조회)  │
    │ - get_style_guide (스타일)   │
    └──────────────────────────────┘
```

### Agent Responsibilities

**Orchestrator Agent:**
- CLI/API 명령 파싱 및 작업 흐름 관리
- 하위 에이전트(Translator, Reviewer) 호출 조정
- 작업 진행 상황 보고

**Translator Agent:**
- 원문 + 용어집 + 스타일 가이드를 기반으로 번역 수행
- 플레이스홀더 (`{0}`, `{1}`) 보존 보장
- 관련 키들을 배치로 번역하여 문맥 유지
- 게임 UI 특성 반영 (짧고 명확한 표현)

**Reviewer Agent:**
- 번역 품질 검수 수행
- 체크 항목: 플레이스홀더 보존, 용어집 준수, 톤/스타일 일관성, 길이 초과, 누락 감지
- 문제 발견 시 리포트 생성 + 자동 수정 제안

### Shared Tools (Python Functions)

- `read_sheet(spreadsheet_id, sheet_name, range?)` - Google Sheets API로 시트 데이터 읽기
- `write_sheet(spreadsheet_id, sheet_name, updates)` - 번역 결과를 시트에 쓰기
- `get_glossary(project_name)` - 프로젝트 용어집 YAML 로드
- `get_style_guide(project_name)` - 프로젝트 스타일 가이드 YAML 로드

### Web Dashboard (React)

**페이지 구성:**
- **프로젝트 목록** - 등록된 게임 프로젝트 대시보드, 번역 진행률 표시
- **스프레드시트 뷰어** - 시트 데이터를 테이블로 표시, 빈 셀 하이라이트
- **번역 실행** - translate/update/review 실행 버튼 + 실시간 진행 상태
- **검수 리포트** - 검수 결과 이력 조회, WARN/ERROR 필터링
- **용어집 편집** - 프로젝트별 용어집 CRUD
- **스타일 가이드 편집** - 프로젝트별 스타일 가이드 CRUD

### FastAPI Backend

**API 엔드포인트:**
- `GET /api/projects` - 프로젝트 목록
- `POST /api/projects` - 프로젝트 등록
- `GET /api/projects/{id}/sheet` - 스프레드시트 데이터 조회
- `POST /api/projects/{id}/translate` - 번역 실행
- `POST /api/projects/{id}/update` - 키 재번역
- `POST /api/projects/{id}/review` - 검수 실행
- `GET /api/projects/{id}/reports` - 검수 리포트 이력
- `GET/PUT /api/projects/{id}/glossary` - 용어집 조회/수정
- `GET/PUT /api/projects/{id}/style-guide` - 스타일 가이드 조회/수정

## Spreadsheet Format

| Key | English(en) | Japanese(ja) | Korean(ko) | Spanish(es) | ... |
|-----|-------------|--------------|------------|-------------|-----|
| ui_ad_center_header | Ad Center | 広告センター | 홍보 센터 | Centro de Anuncios | ... |
| ui_ad_center_desc1 | {0} visits | {0}名訪問 | {0}명 방문 | {0} visitas | ... |

- Row 1: 헤더 (Key + 언어 코드)
- Row 2+: 텍스트 키와 각 언어별 번역
- 언어 열은 스프레드시트 헤더에서 자동 감지

## Project Directory Structure

```
TranslateForGameAgent/
├── pyproject.toml
├── .env                           # GOOGLE_API_KEY 등
│
├── game_translator/               # ADK 에이전트 패키지
│   ├── __init__.py                # root_agent export
│   ├── agent.py                   # Orchestrator (root_agent)
│   ├── sub_agents/
│   │   ├── translator.py
│   │   └── reviewer.py
│   └── tools/
│       ├── sheets.py              # read_sheet, write_sheet
│       ├── glossary.py            # get_glossary, get_style_guide
│       └── config.py              # 프로젝트 설정 로드
│
├── backend/                       # FastAPI 서버
│   ├── main.py                    # FastAPI app
│   ├── routers/
│   │   ├── projects.py
│   │   ├── translate.py
│   │   └── glossary.py
│   └── services/
│       └── agent_runner.py        # ADK Runner 래퍼
│
├── frontend/                      # React 앱
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── ProjectList.tsx
│   │   │   ├── SheetViewer.tsx
│   │   │   ├── ReviewReport.tsx
│   │   │   └── GlossaryEditor.tsx
│   │   └── components/
│   └── vite.config.ts
│
├── cli.py                         # CLI 엔트리포인트
│
├── projects/                      # 프로젝트별 저장 공간
│   └── opal_app/
│       ├── project.yaml
│       ├── glossary.yaml
│       └── style_guide.yaml
│
└── tests/
    ├── test_tools/
    ├── test_agents/
    └── test_api/
```

## CLI Commands

```bash
# 새 키 번역 (빈 셀 채우기)
python cli.py translate --project "opal_app" --sheet "Sheet1"

# 특정 키 재번역 (원문 수정 반영)
python cli.py update --project "opal_app" --keys "ui_ad_center_header,ui_name_warning"

# 전체 검수
python cli.py review --project "opal_app" --sheet "Sheet1"

# 프로젝트 설정
python cli.py config --add --spreadsheet "SPREADSHEET_ID" --name "opal_app"

# ADK Dev UI
adk web

# 웹 대시보드 실행
uvicorn backend.main:app --reload  # 백엔드
cd frontend && npm run dev         # 프론트엔드
```

## Workflows

### translate (빈 셀 번역)

1. Orchestrator가 Sheet Tool로 시트 데이터 읽기
2. 빈 셀이 있는 행 식별
3. 원문 + 용어집 + 스타일 가이드를 Translator Agent에 전달
4. Translator가 모든 대상 언어로 번역 반환
5. Sheet Tool로 결과를 스프레드시트에 쓰기

### update (수정 반영 재번역)

1. Orchestrator가 지정된 키들의 현재 데이터 읽기
2. 원문(기준 언어) 기반으로 Translator Agent에 재번역 요청
3. 전체 대상 언어 재번역 수행
4. Sheet Tool로 결과 업데이트

### review (전체 검수)

1. Orchestrator가 전체 시트 데이터 읽기
2. Reviewer Agent에 데이터 + 용어집 + 스타일 가이드 전달
3. Reviewer가 각 행 검수 수행
4. 검수 리포트 생성 및 출력
5. 자동 수정 가능한 항목은 수정 제안 (사용자 승인 후 적용)

## Translation Quality Strategy

**Translator 프롬프트 전략:**
- 용어집의 고정 용어는 반드시 준수
- 플레이스홀더 (`{0}`, `{1}`) 원본 그대로 보존
- 게임 UI 맥락 반영 (공간 제약, 간결한 표현)
- 관련 키 배치 번역으로 문맥 일관성 유지

**Reviewer 체크리스트:**
1. 플레이스홀더 보존 여부
2. 용어집 준수 여부
3. 톤/스타일 일관성
4. 과도한 길이 (UI 잘림 방지)
5. 누락된 번역 감지

**리포트 형식:**
```
Review Report - Opal App (Sheet1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[WARN] ui_ad_center_desc2 / ja: 용어집 불일치 - "客" → "顧客" 권장
[ERROR] ui_name_warning / zh-Hans: 플레이스홀더 {0} 누락
[OK] 45/47 키 검수 통과
```

## Tech Stack

**Backend:**
- Python 3.11+
- Google ADK (Agent Development Kit) - 에이전트 프레임워크
- Gemini - LLM 백엔드
- FastAPI - REST API 서버
- Google Sheets API v4 - 스프레드시트 연동
- PyYAML - 용어집/스타일 가이드/설정 관리

**Frontend:**
- React 18+ (TypeScript)
- Vite - 빌드 도구
- TanStack Query - 서버 상태 관리
- Tailwind CSS - 스타일링

**CLI:**
- Click or Typer - CLI 프레임워크
