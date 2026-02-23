# Frontend Implementation Plan

## Context

프론트엔드 디자인(Pencil 6개 화면)과 설계 문서(docs/feature/frontend-design.md)가 완료되었다. 백엔드는 아직 없으므로 mock API로 독립 개발한다. 코드가 전혀 없는 상태에서 React 앱을 처음부터 구축한다.

## Tech Stack

- React 18+ (TypeScript strict), Vite, TanStack Query, Tailwind CSS v4, React Router v6

## Directory Structure

```
frontend/
├── src/
│   ├── main.tsx                 # providers (QueryClient, Router)
│   ├── App.tsx                  # route definitions
│   ├── index.css                # Tailwind + design tokens
│   ├── api/
│   │   ├── client.ts            # fetch wrapper + VITE_MOCK_API switch
│   │   ├── projects.ts          # project API functions
│   │   ├── sheets.ts            # sheet API functions
│   │   ├── translation.ts       # job trigger/poll API
│   │   ├── config.ts            # glossary, style guide, sheet context API
│   │   └── mock/
│   │       ├── handlers.ts      # path-matching mock dispatcher
│   │       └── data.ts          # mock data objects
│   ├── hooks/                   # TanStack Query hooks (1 file per domain)
│   ├── types/                   # TypeScript interfaces (1 file per domain)
│   ├── components/
│   │   ├── ui/                  # Button, Input, Textarea, Badge, Card, Modal, Spinner
│   │   ├── layout/              # Sidebar, PageHeader, ProjectLayout
│   │   ├── ProjectCard.tsx
│   │   ├── DataTable.tsx        # reusable table with EditableCell
│   │   ├── EditableCell.tsx
│   │   └── JobStatusBanner.tsx
│   ├── pages/                   # 6 screens (1 file each)
│   └── lib/
│       ├── constants.ts         # query keys
│       └── utils.ts             # helpers
```

## Routing

```
/                                → ProjectList (standalone, no sidebar)
/projects/:projectId             → ProjectLayout > SheetViewer (first sheet)
/projects/:projectId/sheets/:sheetName         → SheetViewer
/projects/:projectId/sheets/:sheetName/settings → SheetSettings
/projects/:projectId/glossary    → GlossaryEditor
/projects/:projectId/style-guide → StyleGuideEditor
/projects/:projectId/reports     → ReviewReport
```

ProjectLayout = Sidebar + `<Outlet />`. URL params drive all state.

## Mock API Strategy

`api/client.ts`에서 `VITE_MOCK_API` env로 분기. mock 모드에서는 `mock/handlers.ts`가 path matching으로 `mock/data.ts` 반환. 백엔드 완성 시 env만 변경하면 전환 완료.

Job polling mock: POST trigger → jobId 반환, GET poll 3회 후 completed로 전이.

## Implementation Phases (순서대로, 각 단계마다 브라우저에서 확인 가능)

### Phase 0: Scaffolding
- `npm create vite` (react-ts) + 의존성 설치
- vite.config.ts (Tailwind plugin, /api proxy)
- index.css (Tailwind imports + design tokens: Inter, #2563EB, #E4E4E7)
- index.html에 Inter 폰트 링크
- main.tsx (QueryClientProvider + RouterProvider)

### Phase 1: Types + Constants
- types/ 전체 (project, sheet, translation, glossary, styleGuide, sheetSettings, review)
- lib/constants.ts (query keys)

### Phase 2: UI Primitives
- Button (Primary/Outline), Input, Textarea, Badge, Card, Modal, Spinner

### Phase 3: Mock API Layer
- api/client.ts, mock/data.ts, mock/handlers.ts
- api/projects.ts, sheets.ts, translation.ts, config.ts

### Phase 4: Screen 1 — Project List
- ProjectCard, CreateProjectModal
- hooks/useProjects.ts
- pages/ProjectList.tsx

### Phase 5: Layout Shell
- Sidebar, PageHeader, ProjectLayout
- hooks/useSheets.ts (sheet list)
- App.tsx route wiring

### Phase 6: Screen 2 — Sheet Viewer
- EditableCell (click-to-edit, read-only for source lang, empty cell highlight)
- DataTable
- ActionBar (Translate All, Update, Review, Settings buttons)
- JobStatusBanner
- hooks/useTranslation.ts (trigger + refetchInterval polling)
- pages/SheetViewer.tsx

### Phase 7: Screen 3 — Sheet Settings
- hooks/useSheetSettings.ts
- pages/SheetSettings.tsx (form: source lang, style, char limit, glossary override, instructions)

### Phase 8: Screen 4 — Glossary Editor
- hooks/useGlossary.ts
- pages/GlossaryEditor.tsx (search, add, inline edit, delete)

### Phase 9: Screen 5 — Style Guide Editor
- hooks/useStyleGuide.ts
- pages/StyleGuideEditor.tsx (tone, formality, audience, rules textarea, examples textarea)

### Phase 10: Screen 6 — Review Report
- pages/ReviewReport.tsx (stat cards, filter badges, issue cards)

### Phase 11: Polish
- Loading/error states, empty cell yellow highlight, job 실행 중 편집 비활성화

## Key Design Decisions

- **Custom DataTable** (v0에서 테이블 라이브러리 불필요 — inline edit + read-only + highlight만 필요)
- **TanStack Query만으로 서버 상태 관리** (Redux/Zustand 불필요 — 로컬 UI state는 useState)
- **URL-driven state** (projectId, sheetName은 URL params → deep link 가능)
- **No WebSocket** (polling으로 충분, 설계 문서 결정 사항)

## Design System (from Pencil)

- Font: Inter
- Accent: #2563EB
- Border: #E4E4E7, 1px, no shadows
- Background: #FFFFFF
- Radius: 6px (sm), 8px (md), 12px (lg)

## Verification

1. `cd frontend && npm run dev` → 브라우저에서 전체 6개 화면 네비게이션 확인
2. Project List → 카드 클릭 → Sheet Viewer 진입 확인
3. Sheet Viewer에서 Translate All 클릭 → JobStatusBanner 진행률 표시 → 완료 후 데이터 새로고침
4. Source language 컬럼 클릭 시 편집 불가 확인
5. Glossary Editor에서 Add/Edit/Delete 동작 확인
6. Review Report에서 필터 badge 클릭 시 이슈 필터링 확인
