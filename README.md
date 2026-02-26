<p align="center">
  <img src="https://img.shields.io/badge/Google%20ADK-Gemini-4285F4?logo=google&logoColor=white" alt="Google ADK" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<p align="center">
  <strong>English</strong> | <a href="README.ko.md">한국어</a> | <a href="README.ja.md">日本語</a>
</p>

# Game Translation Agent

AI-powered multi-agent game localization system. Translate, review, and manage game text across languages — all from a single dashboard.

Built on **Google ADK (Gemini)** with a 3-agent architecture that handles translation, review, and orchestration. Stores everything as local CSV files compatible with **Unity Localization** format.

---

## Features

**Multi-Agent Translation Pipeline**
- **Orchestrator** coordinates translation and review workflows
- **Translator** produces context-aware translations using glossary and style guide
- **Reviewer** checks quality — accuracy, terminology, placeholder preservation

**Full-Featured Dashboard**
- Inline cell editing with real-time save
- CSV upload with key-based merge (overwrite existing, append new)
- CSV export for direct download
- Row CRUD with batch delete
- Language visibility toggle per sheet

**Language Management**
- Project-level language registry with 18+ locale presets (EFIGS, CJK, Tier 2)
- Add/remove languages across all sheets at once
- Auto-detect and register new languages from CSV uploads

**Translation Quality Tools**
- Per-project glossary with source/target/language/context
- Style guide editor (tone, formality, audience, rules)
- Review reports with issue categorization and filtering

**Async Job System**
- Non-blocking translation/review/update jobs
- Real-time progress via WebSocket
- Job history tracking

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   React + Vite  │────▶│    FastAPI       │────▶│   Google ADK     │
│   Dashboard     │◀────│    Backend       │◀────│   (Gemini)       │
└─────────────────┘     └────────┬────────┘     └──────────────────┘
                                 │                 ├─ Orchestrator
                                 ▼                 ├─ Translator
                          ┌──────────────┐         └─ Reviewer
                          │  Local CSV   │
                          │  (Unity fmt) │
                          └──────────────┘
```

### CSV Format (Unity Localization)

```csv
key,English(en),Japanese(ja),Korean(ko)
btn_start,Start Game,ゲームスタート,게임 시작
msg_welcome,"Welcome, {0}!",ようこそ、{0}！,"환영합니다, {0}!"
```

Placeholders like `{0}`, `{1}` are preserved across translations.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [Google Gemini API key](https://aistudio.google.com/apikey)

### 1. Clone & Install

```bash
git clone <repo-url> && cd TranslateForGameAgent

# Backend
pip install -e ".[dev]"

# Frontend
cd frontend && npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
BACKEND_PORT=8000
FRONTEND_PORT=5173
```

### 3. Run

```bash
# Terminal 1 — Backend
uvicorn backend.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Open **http://localhost:5173**

---

## CLI

Run translations without the dashboard:

```bash
# Translate all keys in a sheet
python cli.py translate --project "opal_app" --sheet "UI"

# Update specific keys only
python cli.py update --project "opal_app" --sheet "UI" --keys "key1,key2"

# Review translations for quality
python cli.py review --project "opal_app" --sheet "UI"
```

### ADK Developer Tools

```bash
adk web           # ADK Web UI
adk run game_translator   # Interactive agent session
```

---

## Project Structure

```
├── game_translator/           # ADK agent package
│   ├── agent.py               #   Root orchestrator
│   ├── prompts.py             #   Agent instructions
│   ├── sub_agents/            #   Translator & Reviewer
│   └── tools/                 #   CSV read/write, config, glossary
├── backend/                   # FastAPI server
│   ├── routers/               #   API routes (sheets, jobs, config...)
│   └── services/              #   Business logic
├── frontend/                  # React + TypeScript
│   ├── src/pages/             #   7 page components
│   ├── src/components/        #   20+ UI components
│   ├── src/hooks/             #   Custom React hooks
│   └── src/api/               #   API client layer
├── projects/                  # Project data
│   └── <name>/
│       ├── config.yaml        #     Project settings
│       ├── glossary.yaml      #     Term dictionary
│       ├── style_guide.yaml   #     Translation style
│       └── sheets/            #     CSV files (1 per sheet)
├── tests/                     # Pytest suite
├── docs/feature/              # Design documents
└── cli.py                     # CLI entry point
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI | Google ADK, Gemini |
| Backend | Python 3.11+, FastAPI, PyYAML |
| Frontend | React 19, TypeScript, Vite, TanStack Query, Tailwind CSS |
| Storage | Local CSV + YAML (no database required) |
| CLI | Click |

---

## Testing

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_csv_upload.py -v
```

---

## License

MIT
