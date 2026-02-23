# Frontend Design Document

## Overview

Game Translation Agent의 React 웹 대시보드. 프로젝트 관리, 스프레드시트 뷰어/편집, 번역 실행, 검수 리포트, 용어집/스타일 가이드 관리를 제공한다.

## Design Principles

- **미니말 / 클린**: 흰 배경, 단순 레이아웃, 최소한의 장식
- **사용자**: 개발자 + 번역 팀 (기술 수준 혼합)
- **번역 실행**: 비동기 실행 후 결과 표시 (실시간 스트리밍 불필요)

## Navigation Flow

```
프로젝트 목록 (랜딩)
    └──▶ 프로젝트 상세 (사이드바 + 콘텐츠)
             ├── 시트 뷰어 (기본 화면)
             ├── 시트 설정 (문서별 컨텍스트)
             ├── 용어집 편집
             ├── 스타일 가이드 편집
             └── 검수 리포트
```

## Screens

### 1. 프로젝트 목록 (랜딩 페이지)

**URL**: `/`

**레이아웃**: 헤더 + 카드 그리드

**구성 요소:**
- 헤더: 앱 타이틀 "Game Translator" + [+ 새 프로젝트] 버튼
- 프로젝트 카드 그리드 (반응형, 2~3열)
  - 프로젝트 이름
  - 시트 수
  - 번역 진행률 (%)
  - 미번역 건수
  - 검수 이슈 건수
- 카드 클릭 → `/projects/:id` 로 이동

**새 프로젝트 추가 모달:**
- 프로젝트 이름
- Google Spreadsheet ID
- 기본 기준 언어 선택

### 2. 프로젝트 상세 - 시트 뷰어 (메인)

**URL**: `/projects/:id`  (기본), `/projects/:id/sheets/:sheetName`

**레이아웃**: 사이드바 (고정 240px) + 콘텐츠 영역

**사이드바:**
- 프로젝트 이름 + ← 뒤로가기 링크
- 시트 목록 (시트 간 전환, 활성 시트 하이라이트)
- 구분선
- 용어집
- 스타일 가이드
- 시트 설정
- 검수 리포트

**콘텐츠 영역:**
- 상단 액션 바:
  - 기준 언어 선택 드롭다운
  - [번역 실행] 버튼 - 빈 셀 자동 번역
  - [검수 실행] 버튼 - 전체 검수
- 편집 가능한 테이블:
  - 열: Key | 언어1 | 언어2 | ... (스프레드시트 헤더에서 자동 감지)
  - 셀 클릭 → 인라인 편집 → 포커스 아웃 시 자동 저장 (Google Sheets 반영)
  - 빈 셀: 연한 노란색 배경 하이라이트
  - 검수 이슈 있는 셀: 연한 빨간색 테두리
- 하단 통계 바: 미번역 N건 | 총 키 N개

### 3. 시트 설정 (문서별 컨텍스트)

**URL**: `/projects/:id/sheets/:sheetName/settings`

**구성 요소:**
- **기준 언어**: 이 시트의 원문 언어 (프로젝트 기본값 오버라이드 가능)
- **번역 스타일 프리셋**:
  - 단답형 (UI 라벨) - 짧고 간결
  - 문장형 (설명 텍스트) - 자연스러운 문장
  - 스토리 (나레이션) - 문학적 표현 허용
- **최대 글자 수 제한**: 체크박스 + 숫자 입력 (UI 잘림 방지용)
- **용어집 오버라이드**: 프로젝트 기본 용어집 사용 + 시트 전용 추가 용어 테이블
  - 편집 가능한 미니 테이블 (원문 | 언어별 번역)
  - [+ 용어 추가] 버튼
- **추가 번역 지시사항**: 자유 텍스트 textarea
  - 에이전트에게 전달할 특수 컨텍스트 (예: "이 시트는 가게 UI 텍스트입니다")
- [저장] 버튼

### 4. 용어집 편집

**URL**: `/projects/:id/glossary`

**구성 요소:**
- 상단: 검색 입력창 + [+ 용어 추가] 버튼
- 편집 가능한 테이블:
  - 열: 원문 | 언어1 | 언어2 | ... (프로젝트의 모든 대상 언어)
  - 셀 클릭 → 인라인 편집
  - 행 삭제 버튼 (hover 시 표시)
- 하단: 총 N개 용어

**프로젝트 전체 공통 용어집.** 시트별 오버라이드는 시트 설정에서 관리.

### 5. 스타일 가이드 편집

**URL**: `/projects/:id/style-guide`

**구성 요소:**
- 언어별 설정 카드 (아코디언 또는 리스트):
  - 언어 이름 (예: Japanese(ja))
  - 톤: 텍스트 입력 (예: 丁寧語)
  - 호칭: 텍스트 입력 (예: お客様)
  - 메모: 텍스트 입력 (예: 카타카나 최소화)
- [+ 언어 추가] 버튼
- **공통 지시사항**: textarea (전체 번역에 적용되는 게임 톤/스타일 설명)
- [저장] 버튼

### 6. 검수 리포트

**URL**: `/projects/:id/reports`

**구성 요소:**
- 상단 요약:
  - 최근 검수 일시
  - 결과: N/M 통과 (XX.X%)
- 이슈 테이블:
  - 필터: 상태(ERROR/WARN), 시트, 언어
  - 열: 상태 | 키 | 언어 | 내용
  - 행 클릭 → 해당 시트의 해당 셀로 이동
- 검수 이력 테이블:
  - 열: 날짜 | 결과(%) | 시트
  - 이력 클릭 → 해당 시점의 리포트 상세 보기

## Data Hierarchy

```
프로젝트 (project)
├── project.yaml         (스프레드시트 ID, 기본 기준언어)
├── glossary.yaml        (프로젝트 공통 용어집)
├── style_guide.yaml     (언어별 스타일 + 공통 지시사항)
├── sheets/
│   ├── Sheet1.yaml      (시트별 설정: 기준언어 오버라이드, 번역 스타일,
│   │                     최대 글자수, 용어집 오버라이드, 추가 지시사항)
│   └── Sheet2.yaml
└── reports/
    └── 2026-02-22_14-30.json  (검수 리포트 이력)
```

## Tech Stack

- React 18+ (TypeScript)
- Vite
- React Router - 라우팅
- TanStack Query - 서버 상태 관리 (API 캐싱, 낙관적 업데이트)
- Tailwind CSS - 스타일링
- TanStack Table 또는 AG Grid - 편집 가능한 테이블 컴포넌트

## Component Structure

```
src/
├── App.tsx
├── pages/
│   ├── ProjectList.tsx         # Screen 1
│   ├── ProjectLayout.tsx       # 사이드바 + Outlet
│   ├── SheetViewer.tsx         # Screen 2
│   ├── SheetSettings.tsx       # Screen 3
│   ├── GlossaryEditor.tsx      # Screen 4
│   ├── StyleGuideEditor.tsx    # Screen 5
│   └── ReviewReport.tsx        # Screen 6
├── components/
│   ├── EditableTable.tsx       # 공통 편집 가능 테이블
│   ├── ProjectCard.tsx
│   ├── Sidebar.tsx
│   └── ActionBar.tsx
└── api/
    └── client.ts               # FastAPI 호출 래퍼
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/` | ProjectList | 프로젝트 목록 |
| `/projects/:id` | SheetViewer | 시트 뷰어 (기본 시트) |
| `/projects/:id/sheets/:name` | SheetViewer | 특정 시트 |
| `/projects/:id/sheets/:name/settings` | SheetSettings | 시트 설정 |
| `/projects/:id/glossary` | GlossaryEditor | 용어집 |
| `/projects/:id/style-guide` | StyleGuideEditor | 스타일 가이드 |
| `/projects/:id/reports` | ReviewReport | 검수 리포트 |
