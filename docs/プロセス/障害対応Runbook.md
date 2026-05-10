# 障害対応 Runbook

## 概要

このRunbookは障害発生時に **検知から15分以内** に初動を開始するためのコマンド集です。

**復旧切り替え基準:**
- 前進型修正（マイグレーションで解決）に30分以上かかる見込みの場合
- または整合性エラーが発生している場合
→ R2バックアップからのリストアに切り替える

---

## 共通情報

```bash
# 本番Workers名
WORKER_NAME="gh-trend-tracker-api"

# 本番D1データベース名
DB_NAME="gh-trends-db"

# 本番D1データベースID（wrangler.jsonc で確認）
DB_ID="a9fae3bf-ae66-43af-b167-d329c9e7154d"

# 開発用D1データベース名
DB_NAME_DEV="gh-trends-db-dev"

# R2バックアップバケット名
R2_BUCKET="gh-trends-backups"

# Cloudflare Pages プロジェクト名
PAGES_PROJECT="gh-trend-tracker"
```

> **注意**: `DB_ID` は `apps/backend/wrangler.jsonc` の `env.production.d1_databases[0].database_id` から取得できます。

---

## ① FEエラー（Cloudflare Pages ロールバック）

### 症状

- フロントエンドが表示されない、または崩れている
- Sentry でフロントエンドエラーが急増

### 初動（3分）

```bash
# 1. Sentry でエラー内容を確認
# https://sentry.io/ → gh-trend-tracker → Issues

# 2. Cloudflare Pages のデプロイ履歴を確認
# https://dash.cloudflare.com/ → Workers & Pages → gh-trend-tracker → Deployments
```

### ロールバック手順

```bash
# Cloudflare ダッシュボードから直前の正常なデプロイを選択してロールバック
# Deployments タブ → 正常なデプロイの "..." → "Rollback to this deployment"
```

または CLI でロールバック（Cloudflare API Token が必要）:

```bash
# デプロイ一覧を取得（<ACCOUNT_ID> と <PROJECT_NAME> を実際の値に置換）
curl -H "Authorization: Bearer <CLOUDFLARE_API_TOKEN>" \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/gh-trend-tracker/deployments?per_page=10"

# 正常なデプロイIDを確認してロールバック
curl -X POST \
  -H "Authorization: Bearer <CLOUDFLARE_API_TOKEN>" \
  "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/pages/projects/gh-trend-tracker/deployments/<DEPLOYMENT_ID>/retry"
```

> **ACCOUNT_ID の取得方法**: Cloudflare ダッシュボード右側の「アカウントID」、または `wrangler whoami`

### 動作確認

```bash
# 本番URLにアクセスして表示を確認（実際のURLに置換）
curl -s -o /dev/null -w "%{http_code}" https://<PAGES_URL>
# → 200 が返ることを確認
```

---

## ② APIエラー（5xx）— wrangler rollback

### 症状

- `/api/*` が 500/503 を返す
- Workers Logs にエラーが急増

### 初動（3分）

```bash
# 1. Workers Logs でエラー内容を確認
npx wrangler tail gh-trend-tracker-api --env production --format pretty

# 2. ヘルスチェック
curl -s https://<WORKER_URL>/health
```

> **WORKER_URL の取得方法**: `npx wrangler whoami` 実行後、Cloudflare ダッシュボード → Workers → gh-trend-tracker-api のURLを確認

### ロールバック手順

```bash
cd apps/backend

# 直前バージョンにロールバック
npx wrangler rollback --env production

# バージョン一覧を確認してから特定バージョンにロールバック
npx wrangler deployments list --env production
npx wrangler rollback <VERSION_ID> --env production
```

### 動作確認

```bash
# ヘルスチェック
curl -s https://<WORKER_URL>/health
# → {"status":"ok"} が返ることを確認

# トレンドAPIの疎通確認
curl -s "https://<WORKER_URL>/api/trends/daily?limit=5" | head -c 200
# → JSONレスポンスが返ることを確認
```

---

## ③ DB障害 — Time Travel復元 → R2復元

### 症状

- データが消えた、または壊れた
- DBへの書き込み/読み込みがエラーになる

### 初動（5分）

```bash
# 1. D1 の状態確認
npx wrangler d1 execute gh-trends-db \
  --command="SELECT COUNT(*) as repositories FROM repositories; SELECT COUNT(*) as daily_metrics FROM daily_metrics;" \
  --remote

# 2. 最新レコードのタイムスタンプ確認
npx wrangler d1 execute gh-trends-db \
  --command="SELECT MAX(collected_at) FROM daily_metrics;" \
  --remote
```

### 復旧方針の判断

| 状況 | 手段 |
| --- | --- |
| 障害発生から30日以内 | まず D1 Time Travel を試す |
| 30日超 / Time Travel失敗 | R2バックアップから復元 |
| 前進型修正に30分以上かかる見込み | R2バックアップから復元に切り替え |
| 整合性エラーが発生している | 即座に R2バックアップから復元に切り替え |

---

### 3-A: D1 Time Travel で復元

```bash
# 1. Cloudflare ダッシュボードで復元ポイントを確認
# https://dash.cloudflare.com/ → D1 → gh-trends-db → Time Travel

# 2. CLIで復元（<TIMESTAMP_ISO8601> を実際の値に置換）
#    タイムスタンプ形式: 2026-05-07T00:00:00Z
npx wrangler d1 time-travel restore gh-trends-db \
  --timestamp=<TIMESTAMP_ISO8601>

# 例: 2時間前の状態に復元
npx wrangler d1 time-travel restore gh-trends-db \
  --timestamp=$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%SZ)
```

### 動作確認（Time Travel後）

```bash
# データ件数・整合性チェック
cd apps/backend
npm run db:check -- --remote --env production

# または直接SQLで確認
npx wrangler d1 execute gh-trends-db \
  --command="SELECT COUNT(*) FROM repositories; SELECT COUNT(*) FROM daily_metrics; SELECT MAX(collected_at) FROM daily_metrics;" \
  --remote
```

---

### 3-B: R2バックアップから復元

> **注意**: リストア作業中は本番DBが一時的に更新停止状態になります。バッチは手動で止めてください。

```bash
# 1. R2バケットのバックアップ一覧を確認
npx wrangler r2 object list gh-trends-backups

# 2. 作業ディレクトリを作成
mkdir -p ./restore

# 3. 最新のバックアップファイルをダウンロード（ファイル名例: gh-trends-db_2026-05-07.sql.gz）
npx wrangler r2 object get gh-trends-backups/gh-trends-db_<YYYY-MM-DD>.sql.gz \
  --file=./restore/backup.sql.gz

# または aws-cli（S3互換エンドポイント）を使う場合
# <ACCOUNT_ID> を実際のCloudflareアカウントIDに置換
aws s3 cp s3://gh-trends-backups/gh-trends-db_<YYYY-MM-DD>.sql.gz ./restore/backup.sql.gz \
  --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com

# 4. 解凍
gunzip ./restore/backup.sql.gz
# → ./restore/backup.sql が生成される

# 5. 本番D1に適用（⚠️ 既存データは上書きされます）
npx wrangler d1 execute gh-trends-db \
  --file=./restore/backup.sql \
  --remote

# 6. 一時ファイルを削除
rm -rf ./restore/
```

### 動作確認（R2リストア後）

```bash
# データ件数・整合性チェック
cd apps/backend
npm run db:check -- --remote --env production

# 最新バックアップの日付と件数が一致するか確認
npx wrangler d1 execute gh-trends-db \
  --command="SELECT COUNT(*) as repositories FROM repositories; SELECT COUNT(*) as daily_metrics FROM daily_metrics; SELECT MAX(collected_at) as latest FROM daily_metrics;" \
  --remote
```

---

## ④ 外部API障害（GitHub / Stripe）

### 症状

- GitHub API へのリクエストが失敗する（データ収集バッチが失敗）
- Stripe APIへのリクエストが失敗する（Phase 3以降）

### 確認先

| 外部サービス | ステータスページ |
| --- | --- |
| GitHub | https://www.githubstatus.com/ |
| Stripe | https://status.stripe.com/ |
| Cloudflare | https://www.cloudflarestatus.com/ |

### 対応方針

```bash
# 外部API障害の場合は復旧を待機する
# バッチが失敗しても手動再実行で補完できる（⑤ バッチ失敗 参照）

# GitHub API のレート制限確認（残りリクエスト数）
curl -H "Authorization: Bearer <GITHUB_TOKEN>" \
  https://api.github.com/rate_limit | jq '.rate'
```

### ユーザー告知

外部APIの障害が長時間続く場合は、サービスのステータスをユーザーに告知する。

---

## ⑤ バッチ失敗（GitHub Actions 再実行）

### 症状

- データ収集バッチが失敗した通知を受け取った
- 今日のトレンドデータが更新されていない

### 初動（2分）

```bash
# GitHub Actions のログを確認
# https://github.com/hirata97/gh-trend-tracker/actions/workflows/collect-data.yml
```

### 手動再実行

GitHub UIからの再実行:
```
GitHub リポジトリ → Actions → Daily GitHub Trends Collection → "Run workflow"
```

GitHub CLI（gh コマンド）での再実行:
```bash
# ワークフローを手動トリガー
gh workflow run collect-data.yml --repo hirata97/gh-trend-tracker

# 直近の失敗したジョブを再実行
gh run rerun <RUN_ID> --repo hirata97/gh-trend-tracker
```

curl（REST API）での再実行:
```bash
curl -X POST \
  -H "Authorization: Bearer <GITHUB_TOKEN>" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/hirata97/gh-trend-tracker/actions/workflows/collect-data.yml/dispatches" \
  -d '{"ref":"main"}'
```

### 動作確認

```bash
# バッチ完了後にデータが収集されていることを確認
npx wrangler d1 execute gh-trends-db \
  --command="SELECT collected_at, COUNT(*) as count FROM daily_metrics GROUP BY collected_at ORDER BY collected_at DESC LIMIT 3;" \
  --remote
# → 今日の日付のレコードが存在することを確認
```

---

## ⑥ シークレットローテーション

### ローテーションタイミング

- **定期**: 年1回（1月推奨）
- **即時**: 漏洩が疑われる場合

### 環境変数一覧

| 変数名 | 管理場所 | ローテーション頻度 |
| --- | --- | --- |
| `GITHUB_TOKEN` | GitHub Secrets + wrangler secret | 年1回 or 漏洩時 |
| `INTERNAL_API_TOKEN` | GitHub Secrets + wrangler secret | 年1回 or 漏洩時 |
| `ALLOWED_ORIGINS` | wrangler secret | ドメイン変更時 |
| `CLOUDFLARE_API_TOKEN` | GitHub Secrets | 年1回 or 漏洩時 |

### ローテーション手順

#### GITHUB_TOKEN

```bash
# 1. GitHub → Settings → Developer settings → Personal access tokens → 新しいトークンを生成
#    必要なスコープ: public_repo (読み取り専用でOK)

# 2. Workers のシークレットを更新（再デプロイ不要で即時反映）
cd apps/backend
npx wrangler secret put GITHUB_TOKEN --env production
# → プロンプトに新しいトークンを貼り付け

# 3. GitHub Secrets も更新
# GitHub リポジトリ → Settings → Secrets and variables → Actions → GH_TRENDS_TOKEN を更新

# 4. 旧トークンを無効化
# GitHub → Settings → Developer settings → Personal access tokens → 旧トークンを削除
```

#### INTERNAL_API_TOKEN

```bash
# 1. 新しいランダムトークンを生成
NEW_TOKEN=$(openssl rand -hex 32)
echo "新しいトークン: $NEW_TOKEN"  # メモしておく

# 2. Workers のシークレットを更新
cd apps/backend
npx wrangler secret put INTERNAL_API_TOKEN --env production
# → プロンプトに新しいトークンを貼り付け

# 3. GitHub Secrets も更新（バッチ処理で使用している場合）
# GitHub リポジトリ → Settings → Secrets and variables → Actions → INTERNAL_API_TOKEN を更新
```

#### CLOUDFLARE_API_TOKEN

```bash
# 1. Cloudflare ダッシュボード → My Profile → API Tokens → 新しいトークンを生成
#    必要な権限: D1:Edit, Workers:Edit

# 2. GitHub Secrets を更新
# GitHub リポジトリ → Settings → Secrets and variables → Actions
# → CLOUDFLARE_API_TOKEN を更新

# 3. 旧トークンを Cloudflare で削除
# Cloudflare → My Profile → API Tokens → 旧トークンを削除
```

### 動作確認（ローテーション後）

```bash
# バッチを手動実行してシークレットが正しく動作するか確認
gh workflow run collect-data.yml --repo hirata97/gh-trend-tracker

# Workers のヘルスチェック
curl -s https://<WORKER_URL>/health
```

---

## 連絡経路

| 状況 | 通知経路 | 対応者 |
| --- | --- | --- |
| Sentry エラー率 > 1% | メール自動通知 | リポジトリオーナー |
| GitHub Actions バッチ失敗 | GitHub Actions 通知 | リポジトリオーナー |
| P95 レイテンシ > 500ms | Cloudflare Analytics（手動確認） | リポジトリオーナー |

---

## 関連ドキュメント

- [環境設計 - 障害対応フロー](../設計/diagrams/環境設計.md#障害対応フロー)
- [環境設計 - バックアップ戦略](../設計/diagrams/環境設計.md#バックアップ戦略)
- [環境設計 - 環境変数管理](../設計/diagrams/環境設計.md#環境変数管理)
- [開発ガイド](../基本/開発ガイド.md)
