# CLAUDE.md

このファイルは、Claude Code（claude.ai/code）がこのリポジトリでコードを作業する際のガイダンスを提供します。

## 概要

GitHub Trend Trackerは、GitHubリポジトリのトレンドを定量指標として抽出・可視化するWebサービスです。フラットなモノレポ構成を採用し、プロジェクト間共有とプロジェクト内共有を明確に分離しています。

**技術スタック:**
- **API**: Cloudflare Workers + Hono + Drizzle ORM + Cloudflare D1 (SQLite)
- **フロントエンド**: Astro + React（予定、未実装）
- **共通**: TypeScript（厳格モード有効）
- **パッケージマネージャ**: npm workspaces
- **Node バージョン**: >= 20.0.0

## プロジェクト構造

```
gh-trend-tracker/
├── shared/                      # プロジェクト間共通コード
│   └── types/
│       └── api.ts               # API/Frontend間で共有される型定義
│
├── api/                         # Cloudflare Workers API
│   ├── src/
│   │   ├── routes/              # エンドポイント定義（ファイル分割）
│   │   │   ├── health.ts
│   │   │   ├── trends.ts
│   │   │   ├── repositories.ts
│   │   │   └── languages.ts
│   │   ├── db/
│   │   │   └── schema.ts        # Drizzle ORM スキーマ定義
│   │   ├── shared/              # API内共通コード
│   │   │   ├── queries.ts       # 共通クエリ関数
│   │   │   ├── utils.ts         # ユーティリティ関数
│   │   │   └── constants.ts     # 定数定義
│   │   └── index.ts             # Honoアプリケーションのエントリーポイント
│   ├── schema/
│   │   └── schema.sql           # D1 SQLスキーマ（Drizzleスキーマと同期必須）
│   ├── test/
│   │   ├── health.spec.ts
│   │   └── setup.ts
│   └── public/                  # 静的ファイル
│
├── frontend/                    # Astro フロントエンド（未実装）
│   ├── src/
│   └── package.json
│
└── package.json                 # ワークスペース管理
```

## よく使うコマンド

### 開発

```bash
# API開発サーバー（ルートから）
npm run dev:api

# APIディレクトリで直接作業
cd api
npm run dev

# フロントエンド開発サーバー（実装後）
npm run dev:frontend
```

### テスト

```bash
# API テスト
npm run test:api

# または
cd api
npm run test
```

### ビルドとデプロイ

```bash
# ルートから
npm run build:api
npm run deploy:api

# APIディレクトリから
cd api
npm run deploy         # Cloudflare Workersへデプロイ
```

### データベース操作

```bash
cd api

# WranglerからTypeScript型を生成
npm run cf-typegen

# データベーススキーマを適用（リモートD1）
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --remote

# データベースを直接クエリ
npx wrangler d1 execute gh-trends-db --command="SELECT * FROM repositories LIMIT 10" --remote

# ローカル開発用データベース
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --local
```

## アーキテクチャ

### 共通化の設計思想

このプロジェクトは**2階層のshared構造**を採用：

**1. プロジェクト間共有（`/shared/`）**
- API と Frontend 間で共有されるコード
- 主に型定義（`shared/types/api.ts`）
- Frontendから `import type { TrendsResponse } from '@shared/types/api'` として参照

**2. プロジェクト内共通（`api/src/shared/`）**
- API内の複数ルートで共有される関数・定数
- `queries.ts` - データベースクエリ関数
- `utils.ts` - ユーティリティ関数
- `constants.ts` - 定数定義

### データベーススキーマ

スナップショットベースのアプローチで2つのメインテーブルを使用：

**repositories**: GitHubリポジトリの静的メタデータ
- 格納内容: repo_id, name, full_name, owner, language, description, html_url, topics
- インデックス: language, updated_at

**repo_snapshots**: リポジトリ指標の日次スナップショット
- 格納内容: repo_id (FK), stars, forks, watchers, open_issues, snapshot_date
- (repo_id, snapshot_date)のUNIQUE制約により1日1スナップショットを保証
- インデックス: snapshot_date, (repo_id, snapshot_date)

**重要**: `api/src/db/schema.ts`のDrizzle ORMスキーマは`api/schema/schema.sql`のSQLスキーマと同期を保つ必要があります。データベース構造を変更する際は**必ず両方のファイルを更新**してください。

### APIエンドポイント

全エンドポイントは`api/src/routes/`に分離されており、`index.ts`で統合：

- `GET /health` - ヘルスチェック（`routes/health.ts`）
- `GET /api/trends` - 全言語のトレンドトップ100（`routes/trends.ts`）
- `GET /api/trends/:language` - 特定言語のトップ100（`routes/trends.ts`）
- `GET /api/repos/:repoId/history` - リポジトリの過去90日間のスナップショット（`routes/repositories.ts`）
- `GET /api/languages` - データベース内の全言語リスト（`routes/languages.ts`）

全エンドポイントは`c.env.DB`経由でアクセスされるD1バインディングとDrizzle ORMを使用。

### ルート分離のメリット

- エンドポイントごとにファイルが分かれているため、コードの見通しが良い
- テストもルートごとに作成可能（`test/health.spec.ts`など）
- 複雑なクエリロジックは`api/src/shared/queries.ts`に集約

### バインディングと環境変数

Cloudflare WorkerはD1データベースバインディングを使用：
- **バインディング名**: `DB`（型: `D1Database`）
- **データベース名**: `gh-trends-db`
- `wrangler.jsonc`で設定

環境変数（ローカル開発用に`api/.env`に格納）：
- `GITHUB_TOKEN` - GitHub Personal Access Token（API未使用だがデータ収集用に予定）

### テスト戦略

テストは`@cloudflare/vitest-pool-workers`を使用：
- `env` - D1データベースを含むシミュレートされたバインディング
- `SELF` - fetch経由の統合スタイルテスト

テストファイルは`api/test/`に配置。

### TypeScript設定

**API (`api/tsconfig.json`)**:
- 厳格モード有効（`"strict": true`）
- ターゲット: ES2024
- モジュール: ES2022、Bundler解決
- 出力なし（Wranglerがバンドル処理）
- パスエイリアス: `@shared/*` → `../shared/*`

## 主要な制約事項

### データベース制約
- 1リポジトリにつき1日1スナップショット（UNIQUE制約で強制）
- repo_snapshots.repo_idからrepositories.repo_idへの外部キー、CASCADE削除
- スナップショット日付はISO日付文字列（YYYY-MM-DD）で格納
- タイムスタンプはISO 8601形式のTEXT型を使用

### Cloudflare Workers制限事項
- D1クエリは非同期でPromiseを返す
- D1には読み取り/書き込み制限あり（無料枠で500万回読み取り/日、10万回書き込み/日）
- Worker実行時間制限: 無料枠で50ms CPU時間
- 大規模テーブルの全クエリにインデックスを使用

### コーディング規約
- 新しいエンドポイントは`api/src/routes/`に追加
- 複数ルートで使用するクエリは`api/src/shared/queries.ts`に追加
- API/Frontend間で共有する型は`shared/types/api.ts`に定義
- 全ての型は`@shared/types/api`からimport

## 予定機能（未実装）

- GitHub APIデータ収集スクリプト
- 日次データ収集用GitHub Actions
- Rechartsによる可視化を含むAstroフロントエンド
- スター増加率計算（7日間ウィンドウ）
- Cloudflare Pagesデプロイ

## 重要な注意事項

- **データベースID**: `wrangler.jsonc`のD1データベースIDは環境固有です。新しいデータベースを作成する場合を除き、このIDの変更をコミットしないでください。
- **スキーマ同期**: `api/src/db/schema.ts`と`api/schema/schema.sql`は常に同期を保ってください。
- **CORS**: 現在すべてのオリジンを許可（`cors()`ミドルウェア）。本番環境では制限してください。
- **エラーハンドリング**: 全エンドポイントがエラーをキャッチし、汎用エラーメッセージで500を返します。本番環境ではより具体的なエラーハンドリングを検討してください。
- **クエリ制限**: 全トレンドエンドポイントは100件に制限。履歴エンドポイントは90日間に制限。
