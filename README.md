# GitHub Trend Tracker

GitHubトレンドを定量指標として抽出・可視化するWebサービス

## 概要

GitHub APIから取得したリポジトリデータを定量的に分析し、言語別トレンドランキングや時系列グラフで可視化します。技術選定や学習の優先順位付けに活用できます。

## 主な機能（MVP）

- ✅ 言語別トレンドランキング
- ✅ リポジトリのスター数時系列グラフ
- 🚧 7日間のスター増加率計算
- ✅ GitHub Actionsによる日次データ収集

## 技術スタック

### バックエンド

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Language**: TypeScript

### フロントエンド

- **Framework**: Astro
- **UI Components**: React
- **Charts**: Recharts (予定)
- **Styling**: TailwindCSS (予定)

### DevOps

- **Package Manager**: npm (workspaces)
- **Deployment**: Cloudflare Workers & Pages
- **CI/CD**: GitHub Actions

## プロジェクト構成（モノレポ）

```
gh-trend-tracker/
├── apps/
│   ├── backend/                # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── index.ts        # Hono API エンドポイント
│   │   │   ├── routes/         # ルート定義
│   │   │   ├── schemas/        # Zodスキーマ（バリデーション用）
│   │   │   └── db/
│   │   │       └── schema.ts   # Drizzle ORM スキーマ
│   │   ├── openapi/
│   │   │   └── openapi.yaml    # OpenAPI 3.0仕様書
│   │   ├── schema/
│   │   │   └── schema.sql      # D1 データベーススキーマ
│   │   └── wrangler.jsonc      # Cloudflare設定
│   │
│   └── frontend/               # Astro フロントエンド
│       └── src/
│           ├── components/
│           ├── pages/
│           └── lib/
│
├── shared/                     # Backend/Frontend間の共有型定義
│   └── src/
│       └── index.ts
│
├── docs/                       # ドキュメント
├── tsconfig.base.json          # 共通TypeScript設定
├── package.json                # ワークスペース管理
└── README.md
```

## セットアップ

### 必要な環境

- Node.js >= 20.0.0
- npm >= 10.0.0
- Cloudflareアカウント（無料）
- GitHub Personal Access Token

### 1. リポジトリのクローン

```bash
git clone https://github.com/YOUR_USERNAME/gh-trend-tracker.git
cd gh-trend-tracker
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. Cloudflareログイン

```bash
cd apps/backend
npx wrangler login
```

### 4. 環境変数の設定

`apps/backend/.env`を作成：

```env
GITHUB_TOKEN=your_github_personal_access_token
```

### 5. D1データベースの作成

```bash
cd apps/backend
npx wrangler d1 create gh-trends-db
```

wrangler.jsoncのdatabase_idを更新後、スキーマを適用：

```bash
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --remote
```

### 6. 開発サーバーの起動

```bash
# バックエンド
npm run dev:backend

# フロントエンド
npm run dev:frontend
```

## APIエンドポイント

### `GET /health`

ヘルスチェック

### `GET /api/trends`

全言語のトレンドトップ100

### `GET /api/trends/:language`

指定言語のトレンドランキング

**例**: `/api/trends/TypeScript`

### `GET /api/repos/:repoId/history`

リポジトリの過去90日間のスナップショット履歴

### `GET /api/languages`

データベースに登録されている言語一覧

## デプロイ

### バックエンド（Cloudflare Workers）

```bash
npm run deploy:backend
```

### フロントエンド（Cloudflare Pages）

```bash
npm run deploy:frontend
```

## GitHub Actions 自動化

毎日自動的にGitHubトレンドデータを収集できます。

### セットアップ

詳細な手順は [GitHub Actions セットアップガイド](./docs/github-actions-setup.md) を参照してください。

**必要なシークレット:**

1. `GH_TRENDS_TOKEN` - GitHub Personal Access Token
2. `CLOUDFLARE_API_TOKEN` - Cloudflare API Token
3. `CLOUDFLARE_ACCOUNT_ID` - Cloudflare Account ID

**スケジュール:**

- 毎日UTC 0:00（日本時間 9:00 AM）に自動実行
- GitHubリポジトリの Actions タブから手動実行も可能

### 手動実行

```bash
# ローカルデータベース
cd apps/backend
npm run collect

# リモートデータベース
npm run collect -- --remote
```

## ロードマップ

- [x] Cloudflare D1データベースセットアップ
- [x] Hono API実装
- [x] Drizzle ORMスキーマ定義
- [x] GitHub API データ収集スクリプト
- [x] Astroフロントエンド実装
- [x] 言語フィルタUI
- [x] GitHub Actions 日次実行設定
- [x] CI/CDパイプライン（テスト・ビルド）
- [x] OpenAPI仕様書作成
- [ ] 時系列グラフコンポーネント
- [ ] スター増加率計算ロジック
- [ ] Cloudflare Pagesデプロイ

## コスト

完全無料で運用可能（Cloudflare Free枠内）：

- **D1**: 5GB、500万読み取り/日、10万書き込み/日
- **Workers**: 10万リクエスト/日
- **Pages**: 無制限リクエスト

## ドキュメント

### 開発者向け

- **[CLAUDE.md](./CLAUDE.md)** - Claude Codeによる開発時の参照ドキュメント
  - プロジェクト構造
  - よく使うコマンド
  - アーキテクチャ設計
  - コーディング規約

- **[開発プロセスガイドライン](./docs/development-process.md)** - 新規機能開発時のチェックリスト
  - 企画・構想フェーズ
  - 要件定義（機能要件・非機能要件）
  - 画面設計・データ設計
  - テスト設計・運用設計

### ディレクトリ構造

このプロジェクトはスケーラブルなモノレポ構成（apps/ + shared/）を採用しています：

- `apps/backend/` - Cloudflare Workers API
- `apps/frontend/` - Astro フロントエンド
- `shared/` - Backend/Frontend間の共有型定義
- `docs/` - ドキュメント

詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

## ライセンス

MIT

## 作成者

GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)
