# CLAUDE.md

このファイルは、Claude Code（claude.ai/code）がこのリポジトリでコードを作業する際のガイダンスを提供します。

## 概要

GitHub Trend Trackerは、GitHubリポジトリのトレンドを定量指標として抽出・可視化するWebサービスです。スケーラブルなモノレポ構成（apps/ + packages/）を採用し、プロジェクト間共有とプロジェクト内共有を明確に分離しています。

**技術スタック:**
- **API**: Cloudflare Workers + Hono + Drizzle ORM + Cloudflare D1 (SQLite)
- **フロントエンド**: Astro + React
- **共通**: TypeScript（厳格モード有効）
- **パッケージマネージャ**: npm workspaces
- **Node バージョン**: >= 20.0.0

## プロジェクト構造

```
gh-trend-tracker/
├── apps/                           # アプリケーションコード
│   ├── api/                        # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/             # エンドポイント定義
│   │   │   │   ├── health.ts
│   │   │   │   ├── trends.ts
│   │   │   │   ├── repositories.ts
│   │   │   │   └── languages.ts
│   │   │   ├── db/
│   │   │   │   └── schema.ts       # Drizzle ORM スキーマ定義
│   │   │   ├── shared/             # API内共通コード
│   │   │   │   ├── queries.ts      # 共通クエリ関数
│   │   │   │   ├── utils.ts        # ユーティリティ関数
│   │   │   │   └── constants.ts    # 定数定義
│   │   │   └── index.ts            # Honoアプリケーションのエントリーポイント
│   │   ├── schema/
│   │   │   └── schema.sql          # D1 SQLスキーマ（Drizzleスキーマと同期必須）
│   │   ├── test/
│   │   └── wrangler.jsonc
│   │
│   └── web/                        # Astro フロントエンド
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   └── lib/
│       └── package.json
│
├── packages/                       # 共有パッケージ
│   └── shared-types/               # API/Web間の型定義
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── docs/                           # ドキュメント
├── .github/workflows/              # CI/CD
├── tsconfig.base.json              # 共通TypeScript設定
├── package.json                    # ワークスペース管理
└── CLAUDE.md
```

## よく使うコマンド

### 開発

```bash
# API開発サーバー（ルートから）
npm run dev:api

# Web開発サーバー（ルートから）
npm run dev:web

# 各ディレクトリで直接作業
cd apps/api && npm run dev
cd apps/web && npm run dev
```

### テスト

```bash
# API テスト（ルートから）
npm run test:api

# または
cd apps/api && npm run test
```

### ビルドとデプロイ

```bash
# ルートから
npm run build:api
npm run build:web
npm run deploy:api

# 各ディレクトリから
cd apps/api && npm run deploy
```

### データベース操作

```bash
cd apps/api

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

### 共有コードの境界ルール

このプロジェクトは**2階層の共有構造**を採用：

| 配置場所 | 用途 | 例 |
|----------|------|-----|
| `apps/api/src/shared/` | **API内でのみ**使用するコード | DBクエリ関数、API固有ユーティリティ |
| `apps/web/src/shared/` | **Web内でのみ**使用するコード | UIユーティリティ、フォーマッター |
| `packages/shared-types/` | **複数アプリ間**で共有する型定義 | APIレスポンス型、共通エンティティ型 |

**判断基準**: 2つ以上のアプリで使用する場合のみ `packages/` に昇格させる。

### インポート例

```typescript
// apps/api/src/routes/trends.ts
import type { TrendsResponse } from '@gh-trend-tracker/shared-types'

// apps/web/src/lib/api.ts
import type { TrendsResponse } from '@gh-trend-tracker/shared-types'
```

### データベーススキーマ

スナップショットベースのアプローチで2つのメインテーブルを使用：

**repositories**: GitHubリポジトリの静的メタデータ
- 格納内容: repo_id, name, full_name, owner, language, description, html_url, topics
- インデックス: language, updated_at

**repo_snapshots**: リポジトリ指標の日次スナップショット
- 格納内容: repo_id (FK), stars, forks, watchers, open_issues, snapshot_date
- (repo_id, snapshot_date)のUNIQUE制約により1日1スナップショットを保証
- インデックス: snapshot_date, (repo_id, snapshot_date)

**重要**: `apps/api/src/db/schema.ts`のDrizzle ORMスキーマは`apps/api/schema/schema.sql`のSQLスキーマと同期を保つ必要があります。データベース構造を変更する際は**必ず両方のファイルを更新**してください。

### APIエンドポイント

全エンドポイントは`apps/api/src/routes/`に分離されており、`index.ts`で統合：

- `GET /health` - ヘルスチェック
- `GET /backend/trends` - 全言語のトレンドトップ100
- `GET /backend/trends/:language` - 特定言語のトップ100
- `GET /backend/repos/:repoId/history` - リポジトリの過去90日間のスナップショット
- `GET /backend/languages` - データベース内の全言語リスト

### バインディングと環境変数

Cloudflare WorkerはD1データベースバインディングを使用：
- **バインディング名**: `DB`（型: `D1Database`）
- **データベース名**: `gh-trends-db`
- `wrangler.jsonc`で設定

環境変数（ローカル開発用に`apps/api/.env`に格納）：
- `GITHUB_TOKEN` - GitHub Personal Access Token

### TypeScript設定

**ルート (`tsconfig.base.json`)**:
- 共通設定を定義
- 各アプリがextendsして使用

**API (`apps/api/tsconfig.json`)**:
- `tsconfig.base.json`を継承
- Cloudflare Workers固有の設定
- パスエイリアス: `@gh-trend-tracker/shared-types`

**Web (`apps/web/tsconfig.json`)**:
- Astro設定を継承
- パスエイリアス: `@gh-trend-tracker/shared-types`

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
- 新しいエンドポイントは`apps/api/src/routes/`に追加
- 複数ルートで使用するクエリは`apps/api/src/shared/queries.ts`に追加
- API/Web間で共有する型は`packages/shared-types/src/index.ts`に定義
- 全ての共有型は`@gh-trend-tracker/shared-types`からimport

## 開発プロセス

新規機能追加や大規模な改修を行う前に、`docs/development-process.md`を参照してください。

**重要**: 特に以下の項目は着手前に必ず検討すること
- 目的・価値定義（なぜ作るのか）
- 非機能要件（パフォーマンス、セキュリティ）
- データ設計（後から変更しにくい）

## 重要な注意事項

- **データベースID**: `wrangler.jsonc`のD1データベースIDは環境固有です。新しいデータベースを作成する場合を除き、このIDの変更をコミットしないでください。
- **スキーマ同期**: `apps/api/src/db/schema.ts`と`apps/api/schema/schema.sql`は常に同期を保ってください。
- **CORS**: 現在すべてのオリジンを許可（`cors()`ミドルウェア）。本番環境では制限してください。
- **エラーハンドリング**: 全エンドポイントがエラーをキャッチし、汎用エラーメッセージで500を返します。本番環境ではより具体的なエラーハンドリングを検討してください。
- **クエリ制限**: 全トレンドエンドポイントは100件に制限。履歴エンドポイントは90日間に制限。

## 将来拡張: Turborepo導入判断基準

現時点ではTurborepoを導入せず、npm workspacesのみで運用する。
以下の条件を満たした場合に導入を検討する。

| 条件 | 現状 | 閾値 |
|------|------|------|
| アプリ数 | 2（api, web） | **3以上** |
| 全体ビルド時間 | 数秒 | **1分以上** |
| 開発者数 | 1人 | **3人以上** |
| キャッシュ要求 | 不要 | リモートキャッシュ必要時 |
