# CLAUDE.md

このファイルは、Claude Code（claude.ai/code）がこのリポジトリでコードを作業する際のガイダンスを提供します。

## 概要

GitHub Trend Trackerは、GitHubリポジトリのトレンドを定量指標として抽出・可視化するWebサービスです。

### 目的

GitHub公式のTrendingは24時間/週間/月間の3区分のみで詳細な成長推移が見えず、スター数の絶対値だけでは「今伸びている」プロジェクトを発見しにくい。本サービスは、エンジニアが技術動向を効率的に把握できるようにする。

### ターゲットユーザー

| ペルソナ     | ニーズ                                      |
| ------------ | ------------------------------------------- |
| エンジニア   | 日常的に技術トレンドをチェックしたい        |
| テックリード | チームへの技術導入判断の材料が欲しい        |
| ブロガー     | 週次/月次の技術トレンド記事のネタを探したい |
| 技術選定者   | 新技術の成長性を定量的に評価したい          |

### 開発フェーズ

| Phase                | 状態   | 主な機能                                                                                                            |
| -------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 (MVP)**    | 現在   | トレンドランキング一覧（Top 100）、言語フィルタリング、7日/30日スター増加数表示、リポジトリ詳細（90日間推移グラフ） |
| **Phase 2 (拡張)**   | 計画中 | リポジトリ名検索、お気に入り（ローカルストレージ）、週別トレンドランキング、ソート機能                              |
| **Phase 3 (収益化)** | 将来   | GitHub OAuth認証、AI要約機能（課金/無料プレビュー）、Stripe決済連携                                                 |

### 成功指標

- LCP 2秒以内
- API応答時間 P95 200ms以内
- 稼働率 99%以上

## 技術スタック

| レイヤー        | 技術                      |
| --------------- | ------------------------- |
| Frontend        | Astro + React             |
| Backend         | Cloudflare Workers + Hono |
| Database        | Cloudflare D1 (SQLite)    |
| ORM             | Drizzle ORM               |
| 認証（Phase 3） | GitHub OAuth              |
| 決済（Phase 3） | Stripe                    |
| AI（Phase 3）   | Claude API / OpenAI API   |

**共通設定:**

- TypeScript（厳格モード有効）
- パッケージマネージャ: npm workspaces
- Node バージョン: >= 20.0.0

## プロジェクト構造

```
gh-trend-tracker/
├── apps/                           # アプリケーションコード
│   ├── backend/                    # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/             # エンドポイント定義
│   │   │   │   ├── health.ts
│   │   │   │   ├── trends.ts
│   │   │   │   ├── repositories.ts
│   │   │   │   └── languages.ts
│   │   │   ├── db/
│   │   │   │   └── schema.ts       # Drizzle ORM スキーマ定義
│   │   │   ├── schemas/            # Zodスキーマ（ランタイムバリデーション用）
│   │   │   ├── shared/             # Backend内共通コード
│   │   │   │   ├── queries.ts      # 共通クエリ関数
│   │   │   │   ├── utils.ts        # ユーティリティ関数
│   │   │   │   └── constants.ts    # 定数定義
│   │   │   └── index.ts            # Honoアプリケーションのエントリーポイント
│   │   ├── openapi/
│   │   │   └── openapi.yaml        # OpenAPI 3.0仕様書
│   │   ├── schema/
│   │   │   └── schema.sql          # D1 SQLスキーマ（Drizzleスキーマと同期必須）
│   │   ├── test/
│   │   └── wrangler.jsonc
│   │
│   └── frontend/                   # Astro フロントエンド
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   └── lib/
│       └── package.json
│
├── shared/                         # Backend/Frontend間の共有コード
│   └── src/
│       └── index.ts                # 共有型定義
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
# Backend開発サーバー（ルートから）
npm run dev:backend

# Frontend開発サーバー（ルートから）
npm run dev:frontend

# 各ディレクトリで直接作業
cd apps/backend && npm run dev
cd apps/frontend && npm run dev
```

### テスト

```bash
# Backend テスト（ルートから）
npm run test:backend

# または
cd apps/backend && npm run test
```

### ビルドとデプロイ

```bash
# ルートから
npm run build:backend
npm run build:frontend
npm run deploy:backend

# 各ディレクトリから
cd apps/backend && npm run deploy
```

### データベース操作

```bash
cd apps/backend

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

| 配置場所                    | 用途                               | 例                                  |
| --------------------------- | ---------------------------------- | ----------------------------------- |
| `apps/backend/src/shared/`  | **Backend内でのみ**使用するコード  | DBクエリ関数、API固有ユーティリティ |
| `apps/frontend/src/shared/` | **Frontend内でのみ**使用するコード | UIユーティリティ、フォーマッター    |
| `shared/`                   | **複数アプリ間**で共有する型定義   | APIレスポンス型、共通エンティティ型 |

**判断基準**: 2つ以上のアプリで使用する場合のみ `shared/` に配置する。

### インポート例

```typescript
// apps/backend/src/routes/trends.ts
import type { TrendsResponse } from '@gh-trend-tracker/shared';

// apps/frontend/src/lib/api.ts
import type { TrendsResponse } from '@gh-trend-tracker/shared';
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

**重要**: `apps/backend/src/db/schema.ts`のDrizzle ORMスキーマは`apps/backend/schema/schema.sql`のSQLスキーマと同期を保つ必要があります。データベース構造を変更する際は**必ず両方のファイルを更新**してください。

### APIエンドポイント

全エンドポイントは`apps/backend/src/routes/`に分離されており、`index.ts`で統合：

- `GET /health` - ヘルスチェック
- `GET /api/trends` - 全言語のトレンドトップ100
- `GET /api/trends/:language` - 特定言語のトップ100
- `GET /api/repos/:repoId/history` - リポジトリの過去90日間のスナップショット
- `GET /api/languages` - データベース内の全言語リスト

### バインディングと環境変数

Cloudflare WorkerはD1データベースバインディングを使用：

- **バインディング名**: `DB`（型: `D1Database`）
- **データベース名**: `gh-trends-db`
- `wrangler.jsonc`で設定

環境変数（ローカル開発用に`apps/backend/.env`に格納）：

- `GITHUB_TOKEN` - GitHub Personal Access Token

### TypeScript設定

**ルート (`tsconfig.base.json`)**:

- 共通設定を定義
- 各アプリがextendsして使用

**Backend (`apps/backend/tsconfig.json`)**:

- `tsconfig.base.json`を継承
- Cloudflare Workers固有の設定
- パスエイリアス: `@gh-trend-tracker/shared`

**Frontend (`apps/frontend/tsconfig.json`)**:

- Astro設定を継承
- パスエイリアス: `@gh-trend-tracker/shared`

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

- 新しいエンドポイントは`apps/backend/src/routes/`に追加
- 複数ルートで使用するクエリは`apps/backend/src/shared/queries.ts`に追加
- Backend/Frontend間で共有する型は`shared/src/index.ts`に定義
- 全ての共有型は`@gh-trend-tracker/shared`からimport
- **未使用変数**: アンダースコアプレフィックス（`_var`）で回避せず、根本的に解決する
  - 例: `for (const [_key, value] of map.entries())` → `for (const value of map.values())`
  - コールバックで位置が固定される場合のみ例外的に許可（例: `array.map((_item, index) => index)`）

## ドキュメント

開発時に参照すべきドキュメント：

| ドキュメント     | 概要                                   | パス                          |
| ---------------- | -------------------------------------- | ----------------------------- |
| **要件定義**     | プロジェクト概要、業務/機能/非機能要件 | `docs/requirements/`          |
| **システム設計** | API定義、テーブル定義、画面設計        | `docs/design/`                |
| **開発プロセス** | 開発フロー、品質基準                   | `docs/development-process.md` |

### 要件ID体系

- `req-XXX`: 業務要件（34件）
- `fun-XXX`: 機能要件（54件）
- `non-XXX`: 非機能要件（16件）

### 開発時の注意

新規機能追加や大規模な改修を行う前に、以下を確認すること：

1. **要件確認**: `docs/requirements/` で関連する業務要件・機能要件を確認
2. **設計確認**: `docs/design/` でAPI定義・テーブル定義・画面設計を確認
3. **フェーズ確認**: 実装対象がどのPhaseに属するか確認（Phase 1が優先）

## 重要な注意事項

- **データベースID**: `wrangler.jsonc`のD1データベースIDは環境固有です。新しいデータベースを作成する場合を除き、このIDの変更をコミットしないでください。
- **スキーマ同期**: `apps/backend/src/db/schema.ts`と`apps/backend/schema/schema.sql`は常に同期を保ってください。
- **CORS**: 現在すべてのオリジンを許可（`cors()`ミドルウェア）。本番環境では制限してください。
- **エラーハンドリング**: 全エンドポイントがエラーをキャッチし、汎用エラーメッセージで500を返します。本番環境ではより具体的なエラーハンドリングを検討してください。
- **クエリ制限**: 全トレンドエンドポイントは100件に制限。履歴エンドポイントは90日間に制限。

## 将来拡張: Turborepo導入判断基準

現時点ではTurborepoを導入せず、npm workspacesのみで運用する。
以下の条件を満たした場合に導入を検討する。

| 条件           | 現状                   | 閾値                     |
| -------------- | ---------------------- | ------------------------ |
| アプリ数       | 2（backend, frontend） | **3以上**                |
| 全体ビルド時間 | 数秒                   | **1分以上**              |
| 開発者数       | 1人                    | **3人以上**              |
| キャッシュ要求 | 不要                   | リモートキャッシュ必要時 |
