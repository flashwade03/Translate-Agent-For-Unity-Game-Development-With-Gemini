# Game Translation Agent — System Design

## Goal

Google Spreadsheet에 저장된 게임 텍스트를 다국어 자동 번역하는 에이전트 시스템.

## Tech Stack

- **에이전트 프레임워크**: Google ADK — because 사용자가 ADK 사용을 명시적으로 요구
- **LLM**: Gemini — because ADK는 Gemini 전용
- **스프레드시트**: Google Sheets API v4 — because 번역 데이터가 Google Spreadsheet에 존재
- **설정 저장**: YAML 파일 — because 프로젝트별 설정을 로컬에서 관리하며 사람이 직접 편집 가능해야 함
- **서버**: FastAPI — because 프론트엔드 대시보드에 REST API 제공 필요, Python 에코시스템 통일
- **프론트엔드**: React — because 편집 가능한 테이블 UI와 다중 프로젝트 대시보드 필요

## Architectural Decisions

- **3 에이전트 구조**: Orchestrator(root) → Translator(sub) + Reviewer(sub) — because 번역과 검수는 프롬프트/역할이 근본적으로 다름. Orchestrator가 작업 흐름을 제어.
- **Sheet 작업은 에이전트가 아닌 Tool**: read_sheet, write_sheet는 ADK FunctionTool — because 시트 읽기/쓰기에 LLM 판단이 불필요하고, API 호출만 수행.
- **프로젝트별 격리 저장**: 각 프로젝트는 독립 디렉토리에 설정/용어집/스타일가이드 보유 — because 게임마다 용어와 톤이 완전히 다름.
- **시트별 컨텍스트 오버라이드**: 프로젝트 기본 설정 위에 시트 단위로 기준언어, 번역 스타일, 용어집 추가, 자유 지시사항 오버라이드 가능 — because 하나의 게임 내에서도 UI 텍스트와 스토리 텍스트는 번역 접근이 다름.
- **기준 언어 유동적**: 시트별로 원문 언어가 다를 수 있음 (영어, 한국어, 기타) — because 개발 팀에 따라 원문 작성 언어가 다름.
- **배치 번역**: 관련 키들을 묶어서 한 번에 번역 — because 개별 키 번역 시 문맥이 손실되어 품질 저하.
- **비동기 실행**: 번역/검수는 시간이 걸리므로 비동기 처리 후 결과 반환 — because Gemini API 호출 + 다수 키 처리로 수초~수분 소요.

## Constraints

- **Must**: 플레이스홀더 (`{0}`, `{1}` 등) 번역 시 원본 그대로 보존
- **Must**: 용어집에 등록된 용어는 반드시 해당 번역을 사용
- **Must**: 스프레드시트 헤더에서 언어 코드를 자동 감지 (예: `Japanese(ja)` → `ja`)
- **Must**: ADK 패키지 구조를 따를 것 (`__init__.py`에서 `root_agent` export)
- **Must not**: 셀 단위 개별 API 호출 (batch read/write 사용) — Sheets API 쿼터 제한
- **Must not**: 번역 시 원문 언어 열을 덮어쓰기

## Scope

**In scope (v0)**:
- translate: 빈 셀 탐지 → 자동 번역 → 시트 반영
- update: 지정 키 재번역 → 시트 반영
- review: 전체 시트 검수 → 리포트 생성
- CLI 실행 + REST API (FastAPI)
- 프로젝트별 용어집/스타일가이드 관리
- 시트별 컨텍스트 오버라이드

**Out of scope**:
- 사용자 인증/권한
- 번역 메모리 (Translation Memory)
- 자동 용어집 추출

## v0 이후 검토 방향 (확정 아님 — v0 사용 경험 후 결정)

- 번역 메모리 (TM) 시스템
- 자동 용어집 추출 (기존 번역에서 패턴 학습)
- 실시간 번역 진행 상태 스트리밍 (WebSocket)
- 사용자 인증/멀티 유저
- 번역 이력 diff 비교
- CI/CD 파이프라인 연동 (빌드 시 자동 번역)
