# Frontend Dashboard

## Goal

React 대시보드로 프로젝트 관리, 스프레드시트 뷰어, 번역 실행, 검수 리포트를 제공한다.

## Tech Stack

- **Framework**: React 18+ (TypeScript) — because 컴포넌트 기반 UI에 적합
- **Build**: Vite — because 빠른 HMR, React 생태계 표준
- **Data Fetching**: TanStack Query — because 서버 상태 관리, 캐시, 폴링 내장
- **Styling**: Tailwind CSS — because 유틸리티 기반, 빠른 프로토타이핑

## Screens

1. **프로젝트 목록**: 카드 그리드 랜딩 페이지. 프로젝트 생성/선택.
2. **시트 뷰어**: 사이드바(시트 목록) + 테이블(번역 데이터). 인라인 편집 가능. 번역/업데이트/검수 실행 트리거.
3. **시트 설정**: 시트별 컨텍스트 오버라이드 편집 (소스 언어, 번역 스타일, 용어집 오버라이드, 글자수 제한, 자유 지시사항).
4. **용어집 편집기**: 프로젝트 용어집 CRUD. 원어-번역어 쌍 관리.
5. **스타일가이드 편집기**: 프로젝트 번역 스타일/톤 관리.
6. **검수 리포트**: Reviewer 에이전트 결과 표시. 이슈별 필터링.

## Architectural Decisions

- **사이드바 + 콘텐츠 레이아웃** — because 프로젝트 진입 후 여러 섹션(시트, 용어집, 스타일가이드, 검수)을 빠르게 전환해야 함
- **카드 그리드 프로젝트 목록** — because 다중 프로젝트 관리가 필요하고, 카드 형태가 프로젝트 상태를 한눈에 보여줌
- **비동기 작업 진행률 표시** — because 번역 job이 비동기이므로, 프론트엔드에서 상태 폴링 + 진행률 UI 필요

## Constraints

- Must: 비동기 번역 job의 진행률을 사용자에게 표시
- Must: 소스 언어 셀은 편집 불가로 표시
- Must not: 프론트엔드에서 데이터 소스에 직접 접근 (백엔드 API 경유)

## Scope

**In scope (v0)**: 6개 화면 전체, 프로젝트 CRUD, 번역 실행/모니터링
**Out of scope**: 실시간 협업, 다크 모드, 모바일 반응형

---

## v1 Additions

### Goal

폴링을 WebSocket으로 전환하여 진행률 실시간 수신, Job 이력 화면 추가, 시트 뷰어에서 번역 언어 추가/삭제 가능.

### Screens (v1 변경/추가)

2. **시트 뷰어 (변경)**: 테이블 헤더에서 번역 언어 추가("+" 버튼)/삭제(헤더 아이콘) 가능. 언어 추가 시 "지금 번역할까요?" 확인 다이얼로그. 언어 삭제 시 "이 언어의 번역 N건이 삭제됩니다" 경고 다이얼로그.
7. **Job History (추가)**: 사이드바에 메뉴 추가. 프로젝트 전체 작업 이력 테이블. job 타입, 상태, 시트명, 시각 표시.

### Architectural Decisions (v1)

- **WebSocket으로 진행률 수신** — because v0 폴링(1.5초 refetchInterval)을 대체. TanStack Query 폴링 제거, WebSocket 메시지로 job 상태 업데이트.
- **Job 실행 중에만 WebSocket 연결** — because 항상 연결 유지 불필요. 트리거 시 열고 완료/실패 시 닫음.
- **테이블 헤더에서 언어 관리** — because 시트 뷰어에서 컬럼을 보면서 바로 추가/삭제하는 것이 자연스러움. 별도 설정 페이지 이동 불필요.

### Constraints (v1 추가)

- Must: 언어 추가 시 확인 다이얼로그에서 사용자가 번역 실행 여부 선택 가능
- Must: 언어 삭제 시 삭제될 번역 건수를 경고에 표시
- Must: WebSocket 연결 실패 시에도 진행률 표시가 중단되지 않을 것

### Scope (v1)

**In scope**: WebSocket 진행률, Job History 화면, 언어 추가/삭제 UI + 확인/경고 다이얼로그
**Out of scope**: 다크 모드, 모바일 반응형, 실시간 협업

## v1 이후 검토 방향 (확정 아님 — v1 사용 경험 후 결정)

- 다크 모드
- 모바일 반응형
- 실시간 협업 (동시 편집)
- 번역 비교 뷰 (before/after)
- 대시보드 통계 (번역 진행률, 품질 트렌드)
