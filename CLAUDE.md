# CLAUDE.md

このファイルは、Claude Code（claude.ai/code）がこのリポジトリでコードを作業する際のガイダンスを提供します。

## 概要

GitHub Trend Trackerは、GitHubリポジトリのトレンドを定量指標として抽出・可視化するWebサービスです。npm workspacesによるモノレポ構成を採用しています。

**技術スタック:**
- **API**: Cloudflare Workers + Hono + Drizzle ORM + Cloudflare D1 (SQLite)
- **フロントエンド**: Astro + React（予定、未実装）
- **言語**: TypeScript（厳格モード有効）
- **パッケージマネージャ**: npm workspaces
- **Node バージョン**: >= 20.0.0

## よく使うコマンド

### 開発

```bash
# API開発サーバー（ルートから）
npm run dev:api

# フロントエンド開発サーバー（ルートから、実装時）
npm run dev:frontend

# またはapi/ディレクトリで直接作業
cd api
npm run dev
```

### テスト

```bash
cd api
npm run test           # Cloudflare Workers poolでVitestテストを実行
```

### ビルドとデプロイ

```bash
# ルートから
npm run build:api
npm run deploy:api

# またはapi/ディレクトリから
cd api
npm run build          # 型チェック（出力なし）
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

### データベーススキーマ

プロジェクトはトレンド追跡のためにスナップショットベースのアプローチで2つのメインテーブルを使用：

**repositories**: GitHubリポジトリの静的メタデータ
- 格納内容: repo_id, name, full_name, owner, language, description, html_url, topics
- インデックス: language, updated_at

**repo_snapshots**: リポジトリ指標の日次スナップショット
- 格納内容: repo_id (FK), stars, forks, watchers, open_issues, snapshot_date
- (repo_id, snapshot_date)のUNIQUE制約により1日1スナップショットを保証
- インデックス: snapshot_date, (repo_id, snapshot_date)

**重要**: `api/src/db/schema.ts`のDrizzle ORMスキーマは`api/schema/schema.sql`のSQLスキーマと同期を保つ必要があります。データベース構造を変更する際は必ず両方のファイルを更新してください。

### APIエンドポイント

- `GET /health` - ヘルスチェック
- `GET /api/trends` - 全言語のトレンドトップ100リポジトリ
- `GET /api/trends/:language` - 特定言語のトップ100リポジトリ
- `GET /api/repos/:repoId/history` - リポジトリの過去90日間のスナップショット
- `GET /api/languages` - データベース内の全言語リスト

全エンドポイントは`c.env.DB`経由でアクセスされるD1バインディングとDrizzle ORMを使用。

### バインディングと環境変数

Cloudflare WorkerはD1データベースバインディングを使用：
- **バインディング名**: `DB`（型: `D1Database`）
- **データベース名**: `gh-trends-db`
- `wrangler.jsonc`で設定

環境変数（ローカル開発用に`api/.env`に格納）：
- `GITHUB_TOKEN` - GitHub Personal Access Token（API未使用だがデータ収集用に予定）

### テスト戦略

テストは`@cloudflare/vitest-pool-workers`を使用し、以下を提供：
- `env` - D1データベースを含むシミュレートされたバインディング
- `SELF` - fetch経由の統合スタイルテスト
- `createExecutionContext()` - 実行コンテキスト付きユニットスタイルテスト

テストファイルは`api/test/`に配置、別のtsconfigを使用。

## 主要な制約事項

### TypeScript設定
- 厳格モード有効（`"strict": true`）
- ターゲット: ES2024
- モジュール: ES2022、Bundler解決
- 出力なし（Wranglerがバンドル処理）

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

## 予定機能（未実装）

- GitHub APIデータ収集スクリプト
- 日次データ収集用GitHub Actions
- Rechartsによる可視化を含むAstroフロントエンド
- スター増加率計算（7日間ウィンドウ）
- Cloudflare Pagesデプロイ

## 重要な注意事項

- **データベースID**: `wrangler.jsonc`のD1データベースIDは環境固有です。新しいデータベースを作成する場合を除き、このIDの変更をコミットしないでください。
- **CORS**: 現在すべてのオリジンを許可（`cors()`ミドルウェア）。本番環境では制限してください。
- **エラーハンドリング**: 全エンドポイントがエラーをキャッチし、汎用エラーメッセージで500を返します。本番環境ではより具体的なエラーハンドリングを検討してください。
- **クエリ制限**: 全トレンドエンドポイントは100件に制限。履歴エンドポイントは90日間に制限。
