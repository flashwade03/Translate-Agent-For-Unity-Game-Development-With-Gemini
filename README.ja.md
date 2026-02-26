<p align="center">
  <img src="https://img.shields.io/badge/Google%20ADK-Gemini-4285F4?logo=google&logoColor=white" alt="Google ADK" />
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/React%2019-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind" />
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.ko.md">한국어</a> | <strong>日本語</strong>
</p>

# Game Translation Agent

AIマルチエージェントによるゲームローカライゼーションシステム。翻訳、レビュー、ゲームテキスト管理を1つのダッシュボードで完結します。

**Google ADK (Gemini)** ベースの3エージェントアーキテクチャで、翻訳・レビュー・オーケストレーションを実行します。すべてのデータは **Unity Localization** 互換のローカルCSVファイルで保存されます。

---

## 主な機能

**マルチエージェント翻訳パイプライン**
- **Orchestrator** — 翻訳・レビューワークフローの統括
- **Translator** — 用語集・スタイルガイドを活用したコンテキスト翻訳
- **Reviewer** — 正確性、用語、プレースホルダー保持などの品質チェック

**フル機能ダッシュボード**
- インラインセル編集とリアルタイム保存
- CSVアップロード（キーベースマージ — 既存キーの上書き、新規キーの追加）
- CSVダウンロードエクスポート
- 行の追加・削除および一括削除
- シートごとの言語表示/非表示トグル

**言語管理**
- 18以上のロケールプリセット対応（EFIGS、CJK、Tier 2）
- プロジェクト全体のシートに言語を一括追加・削除
- CSVアップロード時に新しい言語を自動検出・登録

**翻訳品質ツール**
- プロジェクト別用語集（原文/訳文/言語/コンテキスト）
- スタイルガイドエディタ（トーン、敬語レベル、対象読者、ルール）
- 問題分類・フィルタリング付きレビューレポート

**非同期ジョブシステム**
- ノンブロッキング翻訳/レビュー/更新ジョブ
- WebSocketによるリアルタイム進捗表示
- ジョブ履歴追跡

---

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   React + Vite  │────▶│    FastAPI       │────▶│   Google ADK     │
│   ダッシュボード  │◀────│    バックエンド   │◀────│   (Gemini)       │
└─────────────────┘     └────────┬────────┘     └──────────────────┘
                                 │                 ├─ Orchestrator
                                 ▼                 ├─ Translator
                          ┌──────────────┐         └─ Reviewer
                          │  ローカルCSV  │
                          │  (Unity形式)  │
                          └──────────────┘
```

### CSVフォーマット（Unity Localization）

```csv
key,English(en),Japanese(ja),Korean(ko)
btn_start,Start Game,ゲームスタート,게임 시작
msg_welcome,"Welcome, {0}!",ようこそ、{0}！,"환영합니다, {0}!"
```

`{0}`、`{1}` などのプレースホルダーは翻訳時に原文のまま保持されます。

---

## クイックスタート

### 前提条件

- Python 3.11+
- Node.js 18+
- [Google Gemini APIキー](https://aistudio.google.com/apikey)

### 1. クローン＆インストール

```bash
git clone <repo-url> && cd TranslateForGameAgent

# バックエンド
pip install -e ".[dev]"

# フロントエンド
cd frontend && npm install
```

### 2. 環境設定

```bash
cp .env.example .env
```

`.env` を編集:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3-flash-preview
```

### 3. 実行

```bash
# ターミナル1 — バックエンド
uvicorn backend.main:app --reload

# ターミナル2 — フロントエンド
cd frontend && npm run dev
```

**http://localhost:5173** でアクセス

---

## CLI

ダッシュボードなしでCLIから翻訳を実行:

```bash
# シート全体を翻訳
python cli.py translate --project "opal_app" --sheet "UI"

# 特定のキーのみ更新
python cli.py update --project "opal_app" --sheet "UI" --keys "key1,key2"

# 翻訳品質レビュー
python cli.py review --project "opal_app" --sheet "UI"
```

### ADK開発ツール

```bash
adk web                     # ADK Web UI
adk run game_translator     # インタラクティブエージェントセッション
```

---

## プロジェクト構成

```
├── game_translator/           # ADKエージェントパッケージ
│   ├── agent.py               #   ルートオーケストレーター
│   ├── prompts.py             #   エージェントプロンプト
│   ├── sub_agents/            #   Translator & Reviewer
│   └── tools/                 #   CSV読み書き、設定、用語集
├── backend/                   # FastAPIサーバー
│   ├── routers/               #   APIルート
│   └── services/              #   ビジネスロジック
├── frontend/                  # React + TypeScript
│   ├── src/pages/             #   7ページコンポーネント
│   ├── src/components/        #   20以上のUIコンポーネント
│   ├── src/hooks/             #   カスタムReactフック
│   └── src/api/               #   APIクライアント
├── projects/                  # プロジェクトデータ
│   └── <name>/
│       ├── config.yaml        #     プロジェクト設定
│       ├── glossary.yaml      #     用語集
│       ├── style_guide.yaml   #     翻訳スタイル
│       └── sheets/            #     CSVファイル（シートごとに1つ）
├── tests/                     # テスト
├── docs/feature/              # 設計ドキュメント
└── cli.py                     # CLIエントリポイント
```

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| AI | Google ADK, Gemini |
| バックエンド | Python 3.11+, FastAPI, PyYAML |
| フロントエンド | React 19, TypeScript, Vite, TanStack Query, Tailwind CSS |
| ストレージ | ローカルCSV + YAML（データベース不要） |
| CLI | Click |

---

## テスト

```bash
# 全テスト実行
pytest

# 詳細出力
pytest -v

# 特定テストファイルを実行
pytest tests/test_csv_upload.py -v
```

---

## ライセンス

MIT
