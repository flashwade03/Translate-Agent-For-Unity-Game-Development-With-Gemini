<p align="center">
  <img src="https://img.shields.io/badge/Google%20ADK-Gemini-4285F4?logo=google&logoColor=white" alt="Google ADK" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>한국어</strong> | <a href="README.ja.md">日本語</a>
</p>

# Game Translation Agent

AI 멀티 에이전트 기반 게임 로컬라이제이션 시스템. 번역, 리뷰, 게임 텍스트 관리를 하나의 대시보드에서 처리합니다.

**Google ADK (Gemini)** 기반의 3-에이전트 아키텍처로 번역, 리뷰, 오케스트레이션을 수행합니다. **로컬 CSV 파일** (Unity Localization 호환)과 **Google Sheets** (Google Workspace CLI 연동) 모두 지원합니다.

---

## 주요 기능

**멀티 에이전트 번역 파이프라인**
- **Orchestrator** — 번역 및 리뷰 워크플로우 조율
- **Translator** — 용어집과 스타일 가이드를 활용한 문맥 기반 번역
- **Reviewer** — 정확성, 용어, 플레이스홀더 보존 등 품질 검수

**풀기능 대시보드**
- 인라인 셀 편집 및 실시간 저장
- CSV 업로드 (키 기반 머지 — 기존 키 덮어쓰기, 새 키 추가)
- CSV 다운로드 내보내기
- 행 추가/삭제 및 일괄 삭제
- 시트별 언어 표시/숨김 토글

**언어 관리**
- 18개 이상의 로케일 프리셋 (EFIGS, CJK, Tier 2) 지원
- 프로젝트 전체 시트에 언어 일괄 추가/삭제
- CSV 업로드 시 새 언어 자동 감지 및 등록

**번역 품질 도구**
- 프로젝트별 용어집 (원문/번역/언어/맥락)
- 스타일 가이드 편집기 (톤, 격식, 대상 독자, 규칙)
- 이슈 분류 및 필터링이 가능한 리뷰 리포트

**Google Sheets 연동**
- 프로젝트를 Google Sheets 스프레드시트에 직접 연결
- 에이전트로 번역 → 대시보드에서 변경사항 검토 → Sheets에 적용
- 보류 중인 번역은 적용 전까지 로컬(SQLite)에 저장
- 탭, 행, 언어를 시트 헤더에서 자동 감지

**비동기 작업 시스템**
- 논블로킹 번역/리뷰/업데이트 작업
- WebSocket을 통한 실시간 진행 상태
- 작업 이력 추적

---

## 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   React + Vite  │────▶│    FastAPI       │────▶│   Google ADK     │
│   대시보드       │◀────│    백엔드        │◀────│   (Gemini)       │
└─────────────────┘     └────────┬────────┘     └──────────────────┘
                                 │                 ├─ Orchestrator
                                 ▼                 ├─ Translator
                    ┌──────────────────────┐       └─ Reviewer
                    │  로컬 CSV (Unity)    │
                    │  — 또는 —            │
                    │  Google Sheets (gws) │
                    └──────────────────────┘
```

### CSV 포맷 (Unity Localization)

```csv
key,English(en),Japanese(ja),Korean(ko)
btn_start,Start Game,ゲームスタート,게임 시작
msg_welcome,"Welcome, {0}!",ようこそ、{0}！,"환영합니다, {0}!"
```

`{0}`, `{1}` 같은 플레이스홀더는 번역 시 원본 그대로 보존됩니다.

---

## 빠른 시작

### 사전 요구사항

- Python 3.11+
- Node.js 18+
- [Google Gemini API 키](https://aistudio.google.com/apikey)
- (선택) [Google Workspace CLI](https://www.npmjs.com/package/@googleworkspace/cli) — Google Sheets 연동용

### 1. 클론 및 설치

```bash
git clone <repo-url> && cd TranslateForGameAgent

# 백엔드
pip install -e ".[dev]"

# 프론트엔드
cd frontend && npm install
```

### 2. 환경 설정

```bash
cp .env.example .env
```

`.env` 편집:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
BACKEND_PORT=8000
FRONTEND_PORT=5173
```

### 3. (선택) Google Sheets 설정

로컬 CSV 대신 Google Sheets를 데이터 소스로 사용하려면:

```bash
npm install -g @googleworkspace/cli
gws auth login --scopes sheets
```

### 4. 실행

```bash
# 터미널 1 — 백엔드
uvicorn backend.main:app --reload

# 터미널 2 — 프론트엔드
cd frontend && npm run dev
```

**http://localhost:5173** 에서 접속

---

## CLI

대시보드 없이 CLI로 번역 실행:

```bash
# 시트 전체 번역
python cli.py translate --project "opal_app" --sheet "UI"

# 특정 키만 업데이트
python cli.py update --project "opal_app" --sheet "UI" --keys "key1,key2"

# 번역 품질 리뷰
python cli.py review --project "opal_app" --sheet "UI"
```

### ADK 개발 도구

```bash
adk web                     # ADK 웹 UI
adk run game_translator     # 대화형 에이전트 세션
```

---

## 프로젝트 구조

```
├── game_translator/           # ADK 에이전트 패키지
│   ├── agent.py               #   루트 오케스트레이터 + 에이전트 팩토리
│   ├── prompts.py             #   에이전트 프롬프트
│   ├── sub_agents/            #   Translator & Reviewer
│   ├── tools/                 #   CSV 읽기/쓰기, gws 읽기, 보류 저장, 설정, 용어집
│   └── skills/                #   ADK 스킬 정의 (gws_sheets)
├── backend/                   # FastAPI 서버
│   ├── routers/               #   API 라우트 (sheets, jobs, translations, gws...)
│   └── services/              #   비즈니스 로직 (gws_service, pending_translations...)
├── frontend/                  # React + TypeScript
│   ├── src/pages/             #   7개 페이지 컴포넌트
│   ├── src/components/        #   20개 이상 UI 컴포넌트
│   ├── src/hooks/             #   커스텀 React 훅
│   └── src/api/               #   API 클라이언트
├── projects/                  # 프로젝트 데이터
│   └── <name>/
│       ├── config.yaml        #     프로젝트 설정
│       ├── glossary.yaml      #     용어집
│       ├── style_guide.yaml   #     번역 스타일
│       └── sheets/            #     CSV 파일 (시트당 1개)
├── tests/                     # 테스트
├── docs/feature/              # 설계 문서
└── cli.py                     # CLI 진입점
```

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| AI | Google ADK, Gemini |
| 백엔드 | Python 3.11+, FastAPI, PyYAML |
| 프론트엔드 | React 19, TypeScript, Vite, TanStack Query, Tailwind CSS |
| 스토리지 | 로컬 CSV + YAML, Google Sheets (gws CLI 연동), SQLite (작업/보류) |
| CLI | Click |

---

## 테스트

```bash
# 전체 테스트 실행
pytest

# 상세 출력
pytest -v

# 특정 테스트 파일 실행
pytest tests/test_csv_upload.py -v
```

---

## 라이선스

MIT
