# GitHub Trend Tracker

GitHubトレンドを定量指標として抽出・可視化するWebサービス

## 概要

GitHub APIから取得したリポジトリデータを定量的に分析し、言語別トレンドランキングや時系列グラフで可視化します。技術選定や学習の優先順位付けに活用できます。

## 主な機能（MVP）

- ✅ 言語別トレンドランキング
- ✅ リポジトリのスター数時系列グラフ
- 🚧 7日間のスター増加率計算
- 🚧 GitHub Actionsによる日次データ収集

## 技術スタック

### バックエンド（API）
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Language**: TypeScript

### フロントエンド
- **Framework**: Astro (予定)
- **UI Components**: React
- **Charts**: Recharts (予定)
- **Styling**: TailwindCSS (予定)

### DevOps
- **Package Manager**: npm (workspaces)
- **Deployment**: Cloudflare Workers & Pages
- **CI/CD**: GitHub Actions (予定)

## プロジェクト構成（モノレポ）

```
gh-trend-tracker/
├── backend/                    # Cloudflare Workers API
│   ├── src/
│   │   ├── index.ts       # Hono API エンドポイント
│   │   └── db/
│   │       └── schema.ts  # Drizzle ORM スキーマ
│   ├── schema/
│   │   └── schema.sql     # D1 データベーススキーマ
│   └── wrangler.jsonc     # Cloudflare設定
├── frontend/               # Astro フロントエンド（予定）
├── package.json           # ワークスペース管理
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
cd backend
npx wrangler login
```

### 4. 環境変数の設定

`backend/.env`を作成：

```env
GITHUB_TOKEN=your_github_personal_access_token
```

### 5. D1データベースの作成

```bash
cd backend
npx wrangler d1 create gh-trends-db
```

wrangler.jsoncのdatabase_idを更新後、スキーマを適用：

```bash
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --remote
```

### 6. 開発サーバーの起動

```bash
# APIサーバー
npm run dev:backend

# フロントエンド（未実装）
npm run dev:frontend
```

## APIエンドポイント

### `GET /health`
ヘルスチェック

### `GET /backend/trends`
全言語のトレンドトップ100

### `GET /backend/trends/:language`
指定言語のトレンドランキング

**例**: `/backend/trends/TypeScript`

### `GET /backend/repos/:repoId/history`
リポジトリの過去90日間のスナップショット履歴

### `GET /backend/languages`
データベースに登録されている言語一覧

## デプロイ

### API（Cloudflare Workers）

```bash
npm run deploy:backend
```

### フロントエンド（Cloudflare Pages）

```bash
npm run deploy:frontend
```

## ロードマップ

- [x] Cloudflare D1データベースセットアップ
- [x] Hono API実装
- [x] Drizzle ORMスキーマ定義
- [ ] GitHub API データ収集スクリプト
- [ ] GitHub Actions 日次実行設定
- [ ] Astroフロントエンド実装
- [ ] 時系列グラフコンポーネント
- [ ] 言語フィルタUI
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

このプロジェクトはフラットなモノレポ構成を採用しています：

- `shared/` - プロジェクト間共通コード（型定義）
- `backend/` - Cloudflare Workers API
- `frontend/` - Astro フロントエンド（未実装）
- `docs/` - ドキュメント

詳細は [CLAUDE.md](./CLAUDE.md) を参照してください。

## ライセンス

MIT

## 作成者

GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)
