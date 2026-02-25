# Backend API

## Goal

FastAPI 서버로 에이전트 실행을 래핑하고, 프로젝트/설정 관리 API를 제공한다.

## Tech Stack

- **Framework**: FastAPI — because Python 에이전트와 동일 런타임, async 지원
- **Data**: 파일 시스템 (YAML + CSV) — because v0에서 DB 불필요, 프로젝트 디렉토리 구조로 충분

## API Groups

- **Projects**: 프로젝트 CRUD, 목록 조회
- **Sheets**: 로컬 CSV 파일에서 시트 생성/목록/데이터 조회/수정/삭제, 행(key) 추가/일괄 삭제
- **Translation**: 번역/업데이트/검수 작업 트리거 + 상태 조회 + 결과
- **Config**: 용어집, 스타일가이드, 시트별 컨텍스트 관리

## Architectural Decisions

- **비동기 job 모델** — because 대량 시트 번역은 시간이 오래 걸림. 요청 즉시 job ID 반환, 프론트엔드에서 상태 폴링.
- **In-memory Job 관리 (v0)** — because v0에서 Job 이력 영속화 불필요. 서버 재시작 시 소멸 허용.
- **ADK Runner + DatabaseSessionService (SQLite)** — because 에이전트 대화 히스토리를 영속 저장하여 서버 재시작 후에도 세션 유지. Runner가 SessionService를 주입받아 에이전트를 실행.
- **파일 기반 프로젝트 설정** — because v0에서 DB 도입 불필요. `projects/<name>/` 디렉토리에 config.yaml, glossary.yaml, style_guide.yaml 저장.
- **로컬 CSV 파일로 시트 관리** — because 외부 서비스 의존 없이 `projects/<name>/sheets/*.csv` 파일을 직접 읽기/쓰기. 시트 수(sheet_count)는 CSV 파일 개수에서 동적으로 산출.
- **시트 생성 시 프로젝트 기존 언어 헤더 복사** — because 같은 프로젝트 내 시트들은 동일한 번역 대상 언어를 공유하므로, 새 시트 생성 시 기존 시트에서 언어 헤더를 복사하여 일관성 유지.
- **행(key) 단위 추가/삭제 지원** — because 시트에 새 번역 키를 추가하거나 불필요한 키를 제거하는 것이 번역 데이터 관리의 기본 작업.
- **행 일괄 삭제** — because 여러 키를 한 번에 삭제하는 경우가 빈번하므로, 단건 삭제보다 일괄 삭제가 효율적.

## Constraints

- Must: 번역 요청 시 즉시 job ID 반환 (blocking 금지)
- Must: 프로젝트 설정은 `projects/<name>/` 하위 YAML 파일로 관리
- Must: CSV 파일은 `projects/<name>/sheets/` 디렉토리에 저장
- Must not: 에이전트 내부 로직을 API 레이어에서 직접 구현하지 않을 것 (에이전트 호출만)
- Must not: 실행 중인 번역 job이 있는 시트를 삭제하지 않을 것
- Must not: 실행 중인 번역 job이 있는 시트의 행을 삭제하지 않을 것
- Must: 행 추가 시 중복 key 거부

## Flows

### Job 상태 전이

```mermaid
stateDiagram-v2
    [*] --> pending : 번역 요청
    pending --> running : Runner 시작
    running --> completed : 에이전트 성공
    running --> failed : 에이전트 에러
    completed --> [*]
    failed --> [*]
```

### 번역 요청 데이터 흐름 (시퀀스)

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant R as ADK Runner
    participant A as Orchestrator Agent
    participant CSV as CSV File

    FE->>API: 번역 요청 (프로젝트, 시트)
    API->>API: job ID 생성, in-memory 저장
    API-->>FE: job ID + pending 상태
    API->>R: background task 실행
    R->>A: 에이전트 실행
    A->>CSV: 시트 데이터 읽기
    CSV-->>A: 데이터
    A->>A: Translator 위임 → 번역
    A->>CSV: 번역 결과 쓰기
    R-->>API: job 상태 → completed
    FE->>API: job 상태 조회 (polling)
    API-->>FE: 완료 상태
```

## Scope

**In scope (v0)**: 프로젝트 CRUD, CSV 시트 생성/조회/수정/삭제, 행(key) 추가/일괄 삭제, 번역 job 실행/상태, 설정 관리
**Out of scope**: 인증, 멀티 유저, 작업 이력 저장

## Test Strategy

- **범위**: 서비스 레이어(CSV 읽기/쓰기 함수) + API 엔드포인트(FastAPI TestClient) — because 데이터 무결성은 서비스 레이어에서, HTTP 라우팅/에러 응답은 엔드포인트에서 각각 검증해야 함.
- **도구**: pytest + FastAPI TestClient — because 프로젝트 기존 테스트(`tests/test_glossary.py`)와 동일 도구 사용.
- **격리**: 각 테스트는 임시 디렉토리에서 CSV를 생성/조작 — because 테스트 간 상태 간섭 방지.

---

## v1 Additions

### Goal

v0의 폴링 기반 진행률을 WebSocket으로 전환하고, Job 이력을 영속 저장하며, 번역 언어를 동적으로 관리한다.

### Architectural Decisions (v1)

- **WebSocket으로 Job 진행률 전송** — because v0 폴링(1.5초)은 불필요한 요청을 반복하고 응답이 지연됨. 서버가 상태 변경 시 즉시 push.
- **Job 실행 중에만 WebSocket 연결** — because 항상 연결을 유지할 필요가 없음. 프론트엔드가 job 트리거 시 연결, 완료/실패 시 종료.
- **단계 기반 진행률 유지** — because v0에서 충분히 작동함. 전송 방식만 폴링→WebSocket으로 변경, 진행률 계산 로직은 동일.
- **Job 이력 SQLite 영속화** — because v0에서 서버 재시작 시 이력 소멸이 불편. 기존 aiosqlite 인프라 활용.
- **Job 이력 범위: 메타데이터만** — because 에이전트 응답 전체를 저장할 필요는 아직 없음. job ID, 타입, 상태, 시각, 에러만 저장.
- **CSV 컬럼 동적 추가/삭제로 번역 언어 관리** — because 언어 목록이 CSV 헤더에 내재되어 있으므로, 컬럼 추가/삭제가 자연스러운 접근.

### API Groups (v1 추가)

- **Languages**: 시트별 번역 언어 추가/삭제 (CSV 헤더 컬럼 관리)
- **Job History**: 프로젝트별 과거 Job 이력 조회
- **WebSocket**: Job 진행률 실시간 전송

### Flows (v1)

#### WebSocket 진행률 흐름

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant API as FastAPI
    participant R as ADK Runner

    FE->>API: 번역 요청 (REST)
    API-->>FE: job ID + pending
    FE->>API: WebSocket 연결 (job ID)
    API->>R: background task 실행
    loop 단계별 진행
        R-->>API: 상태 변경
        API-->>FE: WebSocket push (상태, 진행률)
    end
    API-->>FE: completed/failed
    FE->>FE: WebSocket 종료
```

### Constraints (v1 추가)

- Must: WebSocket 연결은 job 완료/실패 시 서버 측에서 종료 메시지 전송
- Must: 언어 삭제 시 해당 컬럼의 기존 데이터가 영구 삭제됨을 API 응답에 명시
- Must not: WebSocket을 job 진행률 외 용도로 사용하지 않을 것 (v1 범위)

### Scope (v1)

**In scope**: WebSocket 진행률, Job SQLite 영속화 + 이력 조회 API, 번역 언어 추가/삭제 API
**Out of scope**: 인증, 멀티 유저, 동시 작업 제한, CSV 업로드

## 다음 스펙 대상 (v0 미설계 항목)

- 시트 설정 API (Screen 3 지원) — 소스 언어 변경, 번역 스타일/용어집 오버라이드/글자수 제한/지시사항 저장

## v1 이후 검토 방향 (확정 아님 — v1 사용 경험 후 결정)

- 사용자 인증 (Google OAuth)
- 동시 작업 제한 / 큐 관리
- CSV 파일 업로드 API
- Google Sheets 연동 (선택적)
