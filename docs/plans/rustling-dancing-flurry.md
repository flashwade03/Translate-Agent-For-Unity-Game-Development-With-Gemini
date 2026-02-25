# Screen 3 — Sheet Settings 모달 전환 + 설계 문서 정합성

## Context

Sheet Settings가 이미 구현되어 있으나 설계 문서와 여러 차이가 있다:
- **프론트엔드**: 별도 페이지 → 설계는 모달 다이얼로그
- **백엔드 저장**: 시트별 개별 YAML (`sheets/<name>.yaml`) → 설계는 프로젝트 `config.yaml` 내 시트별 섹션
- **모델**: `glossaryOverride`가 `bool` → 설계/Pencil은 텍스트 입력 (용어 쌍 문자열)
- **UI**: Translation Style이 `<select>` → Pencil은 자유 텍스트 입력
- **프로젝트 기본값**: 미구현 → 설계는 "미설정 필드는 프로젝트 기본값을 placeholder로 표시"
- **오버라이드 전용 저장**: 미구현 → 설계는 "시트별 오버라이드만 저장"

## Tasks

### Task 1: Backend 모델 + 저장소 리팩터

**파일**: `backend/models.py`, `backend/services/config_service.py`

모델 변경:
- `SheetSettings.glossary_override`: `bool` → `str = ""`
- 모든 설정 필드를 `Optional`로 변경 (null = 프로젝트 기본값 사용)
- `SheetSettingsResponse` 추가: 시트 오버라이드 + `projectDefaults` 포함

저장소 리팩터 (`config_service.py`):
- `get_sheet_settings()`: config.yaml에서 `sheet_settings.<sheet_name>` 섹션 읽기
- `update_sheet_settings()`: config.yaml의 해당 섹션에 오버라이드만 저장 (null/빈값은 제거)
- `get_project_defaults()`: config.yaml에서 `defaults` 섹션 읽기 (없으면 하드코딩 기본값)
- 기존 per-sheet YAML 파일 로직 삭제

config.yaml 구조:
```yaml
name: "Opal App"
description: "..."
defaults:
  source_language: "en"
  translation_style: ""
  character_limit: null
  glossary_override: ""
  instructions: ""
sheet_settings:
  UI:
    translation_style: "formal"
    character_limit: 30
```

### Task 2: Backend 라우터 업데이트

**파일**: `backend/routers/config.py`

- `GET /settings` 응답에 `projectDefaults` 포함
- `PUT /settings` 요청에서 null 필드는 오버라이드 제거 (기본값 복원)

### Task 3: Backend 테스트

**파일**: `tests/test_config_api.py` (기존 수정)

- config.yaml 기반 저장소 테스트
- 프로젝트 기본값 상속 테스트
- 오버라이드 저장/제거 테스트
- glossary_override 문자열 타입 테스트

### Task 4: Frontend 타입 + API + Mock 업데이트

**파일**: `frontend/src/types/sheetSettings.ts`, `frontend/src/api/mock/handlers.ts`, `frontend/src/api/mock/data.ts`

- `SheetSettings` 타입: `glossaryOverride` → `string`, 모든 필드 optional (`| null`)
- `SheetSettingsResponse` 타입 추가: `settings` + `projectDefaults`
- Mock 핸들러: 기본값 응답에 `projectDefaults` 포함
- API 함수 반환 타입 업데이트

### Task 5: Frontend SheetSettingsDialog 컴포넌트

**파일**: `frontend/src/components/SheetSettingsDialog.tsx` (신규)

기존 `pages/SheetSettings.tsx`의 폼 로직을 Modal 기반 다이얼로그로 재작성:
- `Modal` 컴포넌트 사용 (`max-w-lg`로 확대)
- Source Language: Input, placeholder에 프로젝트 기본값
- Translation Style: Input (자유 텍스트), placeholder에 프로젝트 기본값
- Character Limit: Input type="number", placeholder에 기본값
- Glossary Override: Textarea, placeholder "source_term → translated_term (one per line)"
- Custom Instructions: Textarea, placeholder에 프로젝트 기본값
- Footer: Cancel + Save Changes 버튼
- null/빈값은 "프로젝트 기본값 사용 중" 의미

### Task 6: Frontend SheetViewer 통합 + 라우트 정리

**파일**: `frontend/src/pages/SheetViewer.tsx`, `frontend/src/App.tsx`

- SheetViewer에 `settingsOpen` state 추가
- Settings 버튼: `navigate()` → `setSettingsOpen(true)`
- SheetSettingsDialog 렌더링
- `App.tsx`에서 `/settings` 라우트 제거
- `pages/SheetSettings.tsx` 삭제

### Task 7: Hook 업데이트

**파일**: `frontend/src/hooks/useSheetSettings.ts`

- `useSheetSettings` 반환 타입을 `SheetSettingsResponse`로 변경
- mutation 후 settings + sheetData 모두 invalidate (소스 언어 변경 시 테이블 갱신)

### Task 8: 검증

- `cd /Volumes/FablersBackup/Projects/TranslateForGameAgent && python -m pytest tests/ -v`
- `cd frontend && npx tsc --noEmit`
- 브라우저: Sheet Viewer → Settings 버튼 → 모달 열림/저장/닫기

## Critical Files

| 파일 | 작업 |
|------|------|
| `backend/models.py` | SheetSettings 모델 수정, SheetSettingsResponse 추가 |
| `backend/services/config_service.py` | config.yaml 기반 저장소로 리팩터 |
| `backend/routers/config.py` | 응답에 projectDefaults 포함 |
| `tests/test_config_api.py` | 테스트 리팩터 |
| `frontend/src/types/sheetSettings.ts` | 타입 수정 |
| `frontend/src/components/SheetSettingsDialog.tsx` | 신규 모달 컴포넌트 |
| `frontend/src/pages/SheetViewer.tsx` | 모달 통합 |
| `frontend/src/pages/SheetSettings.tsx` | 삭제 |
| `frontend/src/App.tsx` | /settings 라우트 제거 |
| `frontend/src/hooks/useSheetSettings.ts` | 반환 타입 변경 |
| `frontend/src/api/mock/handlers.ts` | mock 응답 수정 |
