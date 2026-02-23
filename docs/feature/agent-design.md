# Game Translation Agent

## Goal

Google ADK 기반 멀티 에이전트 시스템으로, Google Spreadsheet의 게임 텍스트를 다국어로 번역/검수한다.

## Tech Stack

- **Agent Framework**: Google ADK — because Gemini 네이티브 지원, 멀티 에이전트 내장
- **LLM**: Gemini — because ADK 통합, 다국어 번역 품질 충분
- **Spreadsheet**: Google Sheets API v4 — because 기존 게임 개발 워크플로우가 Google Sheets 기반
- **Config**: YAML — because 사람이 읽고 편집 가능, 별도 DB 불필요

## Agent Roles

- **Orchestrator** (root_agent): 사용자 요청을 해석하고 하위 에이전트에게 분배. 직접 번역하지 않음.
- **Translator** (sub_agent): 용어집과 스타일가이드를 참조하여 번역 수행. 시트별 컨텍스트 오버라이드 반영.
- **Reviewer** (sub_agent): 번역 결과의 품질 검수. 플레이스홀더 보존, 용어집 준수, 톤 일관성 확인.

Sheet 읽기/쓰기는 에이전트가 아닌 **공유 도구**로 처리 — because 상태 없는 CRUD 작업에 에이전트 오버헤드 불필요.

## Tools

- **MCP Google Sheets** (`mcp-google-sheets`): 시트 읽기/쓰기. ADK McpToolset으로 stdio 연결 — because Sheets API 래핑을 직접 구현하지 않고 MCP 생태계 활용.
- **get_project_config / get_sheet_context**: 프로젝트/시트별 YAML 설정 로드
- **get_glossary / get_style_guide**: 프로젝트별 YAML에서 로드

## Workflows

- **translate**: 시트 전체 읽기 → 모든 대상 언어로 번역 → 결과 쓰기
- **update**: 지정된 키만 읽기 → 해당 키만 번역 → 결과 쓰기
- **review**: 시트 전체 읽기 → 품질 검수 → 리포트 생성

### Translate 워크플로우 (시퀀스)

```mermaid
sequenceDiagram
    participant U as User
    participant O as Orchestrator
    participant T as Translator
    participant MCP as MCP Sheets
    participant Y as YAML Config

    U->>O: "Translate UI sheet for opal_app"
    O->>Y: get_project_config("opal_app")
    Y-->>O: spreadsheet_id, default_source_language
    O->>MCP: get_sheet_data(spreadsheet_id, "UI")
    MCP-->>O: headers + rows
    O->>Y: get_sheet_context, get_glossary, get_style_guide
    Y-->>O: context, glossary, style_guide
    loop 각 target language
        O->>T: 번역 요청 (source text + context)
        T-->>O: translated key-value pairs (JSON)
    end
    O->>MCP: batch_update_cells(translations)
    MCP-->>O: success
    O-->>U: 완료 리포트
```

## Architectural Decisions

- **MCP로 Sheets 연동** — because Sheets API 래핑을 직접 구현하지 않고, `mcp-google-sheets` 서버를 ADK McpToolset(stdio)으로 연결. 도구 19개를 그대로 사용.
- **소스 언어 유동적** — because 게임 개발에서 영어 외 언어가 원문일 수 있음 (시트 헤더에서 자동 감지)
- **전체 언어 자동 번역** — because 타겟 언어를 매번 수동 선택하는 것은 비효율적
- **프로젝트별 용어집/스타일가이드** — because 게임마다 고유 용어와 톤이 다름. YAML로 프로젝트 디렉토리에 저장.
- **시트별 컨텍스트 오버라이드** — because 같은 프로젝트 내에서도 시트마다 번역 맥락이 다를 수 있음 (UI 텍스트 vs 스토리 vs 튜토리얼). 소스 언어, 번역 스타일, 용어집 오버라이드, 글자수 제한, 자유 지시사항 설정 가능.

## Constraints

- Must: 플레이스홀더 ({0}, {1}, {player_name} 등) 원본 그대로 보존
- Must: Google Sheets API는 batch read/write 사용 (쿼터 관리)
- Must: 스프레드시트 헤더에서 언어 코드 자동 감지 (예: `Japanese(ja)` → `ja`)
- Must not: 소스 언어 컬럼을 수정하지 않을 것
- Must not: 에이전트가 도구 없이 스프레드시트에 직접 접근하지 않을 것

## Scope

**In scope (v0)**: CLI를 통한 translate/update/review 실행, 프로젝트별 설정 관리
**Out of scope**: 번역 메모리, 자동 용어 추출, 번역 품질 점수화

## v0 이후 검토 방향 (확정 아님 — v0 사용 경험 후 결정)

- 번역 메모리 / 캐시
- 자동 용어집 추출 (번역 결과에서 반복 패턴 감지)
- 번역 품질 점수화 (정량적 메트릭)
- 병렬 번역 (여러 시트 동시 처리)
