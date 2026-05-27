# GitHub Actions 自動化セットアップガイド

このガイドでは、GitHub Actionsを使って毎日自動的にGitHubトレンドデータを収集する方法を説明します。

## 概要

`.github/workflows/collect-data.yml` は以下を実行します：

- **スケジュール**: 毎日UTC 0:00（日本時間 9:00 AM）に自動実行
- **手動実行**: GitHub UIから手動でトリガー可能
- **処理内容**:
  1. リポジトリをチェックアウト
  2. Node.js環境をセットアップ
  3. 依存関係をインストール
  4. データ収集スクリプトを実行（リモートD1データベースに保存）
  5. データベースの件数を確認

## 必要なシークレット

GitHub Actionsを動作させるには、以下の3つのシークレットをGitHubリポジトリに設定する必要があります。

### 1. GH_TRENDS_TOKEN (GitHub Personal Access Token)

データ収集用のGitHub APIアクセストークン

**取得方法:**

1. https://github.com/settings/tokens にアクセス
2. **"Generate new token (classic)"** をクリック
3. 設定:
   - Note: `gh-trends-collector-actions`
   - Expiration: No expiration（または長期間）
   - Scopes: `public_repo` のみチェック
4. **"Generate token"** をクリック
5. 表示されたトークン（`ghp_...`）をコピー

### 2. CLOUDFLARE_API_TOKEN

Cloudflare WorkersへのデプロイとD1データベースアクセス用

**取得方法:**

1. https://dash.cloudflare.com/profile/api-tokens にアクセス
2. **"Create Token"** をクリック
3. **"Edit Cloudflare Workers"** テンプレートを選択
4. または、カスタムトークンで以下の権限を設定:
   - Account > D1 > Edit
   - Account > Workers Scripts > Edit
5. **"Continue to summary"** → **"Create Token"** をクリック
6. 表示されたトークンをコピー

### 3. CLOUDFLARE_ACCOUNT_ID

あなたのCloudflareアカウントID

**取得方法:**

1. https://dash.cloudflare.com にアクセス
2. 任意のサイト/Workers & Pagesページを開く
3. 右サイドバーの **"Account ID"** をコピー
   - または、URLから確認: `https://dash.cloudflare.com/<ACCOUNT_ID>/...`

## シークレットの設定手順

### ステップ1: GitHubリポジトリにアクセス

1. https://github.com/YOUR_USERNAME/gh-trend-tracker にアクセス
2. **Settings** タブをクリック

### ステップ2: Secrets and variables を開く

1. 左サイドバーの **"Secrets and variables"** を展開
2. **"Actions"** をクリック

### ステップ3: シークレットを追加

各シークレットを以下の手順で追加:

1. **"New repository secret"** ボタンをクリック
2. **Name** と **Secret** を入力:

   **シークレット1:**
   - Name: `GH_TRENDS_TOKEN`
   - Secret: `ghp_your_github_token_here`

   **シークレット2:**
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: `your_cloudflare_api_token_here`

   **シークレット3:**
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Secret: `your_cloudflare_account_id_here`

3. **"Add secret"** をクリック

### ステップ4: 設定を確認

3つのシークレットが表示されていることを確認:

```
GH_TRENDS_TOKEN              Updated X seconds ago
CLOUDFLARE_API_TOKEN         Updated X seconds ago
CLOUDFLARE_ACCOUNT_ID        Updated X seconds ago
```

## リモートD1データベースの準備

GitHub Actionsはリモート（本番）のD1データベースを使用します。

### データベースの作成

```bash
cd backend
npx wrangler d1 create gh-trends-db
```

出力された `database_id` を `backend/wrangler.jsonc` に設定します。

### スキーマの適用

```bash
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --remote
```

### 確認

```bash
npx wrangler d1 execute gh-trends-db \
  --command="SELECT name FROM sqlite_master WHERE type='table'" \
  --remote
```

## ワークフローのテスト

### 手動実行でテスト

1. GitHubリポジトリの **"Actions"** タブを開く
2. 左サイドバーの **"Daily GitHub Trends Collection"** をクリック
3. **"Run workflow"** ドロップダウンをクリック
4. **"Run workflow"** ボタンをクリック

### 実行ログの確認

1. 実行中のワークフローをクリック
2. **"collect-data"** ジョブをクリック
3. 各ステップの詳細ログを確認

**期待される出力:**

```
✓ Fetched 500 repos
✓ Saved 500 repos
✓ Data collection complete!
```

### エラー時の対処

**エラー: `Error: GITHUB_TOKEN environment variable is required`**

- シークレット `GH_TRENDS_TOKEN` が正しく設定されているか確認

**エラー: `Authentication error: Invalid API token`**

- シークレット `CLOUDFLARE_API_TOKEN` が正しいか確認
- トークンの権限が適切か確認（D1とWorkers編集権限）

**エラー: `Database not found`**

- リモートD1データベースが作成されているか確認
- `wrangler.jsonc` の `database_id` が正しいか確認

## スケジュールのカスタマイズ

`.github/workflows/collect-data.yml` の cron 式を変更できます:

```yaml
schedule:
  # 毎日UTC 0:00（日本時間 9:00）
  - cron: '0 0 * * *'
```

**例:**

```yaml
# 12時間ごと（UTC 0:00 と 12:00）
- cron: '0 0,12 * * *'

# 毎週月曜日のUTC 0:00
- cron: '0 0 * * 1'

# 毎月1日のUTC 0:00
- cron: '0 0 1 * *'
```

**Cron式の形式:**

```
分 時 日 月 曜日
0  0  *  *  *
```

## 通知の設定

データ収集が失敗した場合に通知を受け取る:

1. GitHubリポジトリの **Settings** → **Notifications**
2. **"Actions"** セクションで通知方法を選択
   - Email
   - Web
   - Mobile

## ワークフローの無効化

データ収集を一時停止したい場合:

1. **Actions** タブを開く
2. 左サイドバーの **"Daily GitHub Trends Collection"** をクリック
3. 右上の **"..."** メニュー → **"Disable workflow"** をクリック

再開する場合は **"Enable workflow"** をクリック。

## ベストプラクティス

### 1. トークンの有効期限管理

- GitHubトークン: 90日または無期限
- Cloudflareトークン: 定期的にローテーション推奨

### 2. レート制限の監視

GitHub APIレート制限を監視:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/rate_limit
```

### 3. データベース容量の確認

D1の無料枠:

- 5GB ストレージ
- 500万読み取り/日
- 10万書き込み/日

容量監視:

```bash
npx wrangler d1 execute gh-trends-db \
  --command="SELECT COUNT(*) FROM repositories" \
  --remote
```

### 4. ログの保持

GitHub Actionsのログは90日間保持されます。重要なデータは別途保存を推奨。

## トラブルシューティング

### ワークフローが実行されない

**原因:** リポジトリが非アクティブ
**解決:** 60日以上プッシュがないとスケジュールワークフローが無効化されます。手動実行で再有効化。

### データが重複する

**原因:** 同じ日に複数回実行
**解決:** `INSERT OR IGNORE` を使用しているため、スナップショットは重複しません（repo_id, snapshot_dateのUNIQUE制約）。

### APIレート制限エラー

**原因:** GitHub APIの制限（5000リクエスト/時）
**解決:**

- トークンが正しく設定されているか確認
- レート制限をチェック
- 必要に応じてリクエスト数を減らす

## まとめ

これで毎日自動的にGitHubトレンドデータが収集され、リモートD1データベースに保存されます。

---

## D1 日次バックアップ（backup-d1.yml）

`.github/workflows/backup-d1.yml` は毎日 UTC 02:00（日本時間 11:00）に D1 データベースを R2 へエクスポートします。

### バックアップフロー

```
毎日 UTC 02:00
  └─ backup ジョブ
       ├─ D1 export → /tmp/gh-trends-db_YYYY-MM-DD.sql
       ├─ gzip 圧縮 → /tmp/gh-trends-db_YYYY-MM-DD.sql.gz
       └─ R2 put → gh-trends-backups/gh-trends-db_YYYY-MM-DD.sql.gz
```

### 追加シークレットの設定

バックアップ用に **最小権限の R2 API トークン** を別途作成し、2つのシークレットを追加します。

#### R2 API トークンの作成

1. https://dash.cloudflare.com/profile/api-tokens にアクセス
2. **"Create Token"** → **"Create Custom Token"** を選択
3. 以下の権限を設定：
   - **Permissions**: `Object Storage（R2）` → `Edit`（または `Object Read & Write`）
   - **Resources**: `Account > gh-trends-backups`（該当バケットのみ）
4. **"Continue to summary"** → **"Create Token"** をクリック
5. 表示された `Access Key ID` と `Secret Access Key` をコピー

> **Note**: Cloudflare R2 は S3 互換 API を提供します。aws-cli を使用するため、アクセスキー形式のトークンが必要です。

#### GitHub Secrets への登録

| シークレット名 | 値 |
| --- | --- |
| `R2_BACKUP_ACCESS_KEY_ID` | R2 API トークンの Access Key ID |
| `R2_BACKUP_SECRET_ACCESS_KEY` | R2 API トークンの Secret Access Key |

> `CLOUDFLARE_ACCOUNT_ID` は既存のシークレットを流用します。

### R2 バケットの作成

バケット作成と90日ライフサイクルルールの設定は **Cloudflare ダッシュボード** から行います。

1. https://dash.cloudflare.com → **R2 Object Storage** を開く
2. **"Create bucket"** → バケット名: `gh-trends-backups`
3. バケット作成後、**"Settings"** タブ → **"Object lifecycle policies"** を開く
4. **"Add rule"** をクリックし、以下を設定：
   - Rule name: `delete-after-90-days`
   - Prefix: （空欄）
   - Days until object expiration: `90`
5. **"Save"** をクリック

### 手動実行でテスト

1. GitHub リポジトリの **"Actions"** タブを開く
2. 左サイドバーの **"D1 Daily Backup to R2"** をクリック
3. **"Run workflow"** → **"Run workflow"** をクリック
4. 実行ログで `Upload to R2` ステップが成功することを確認
5. Cloudflare ダッシュボードの R2 バケットに `gh-trends-db_YYYY-MM-DD.sql.gz` が存在することを確認

---

## 月次リストアテスト（restore-test.yml）

`.github/workflows/restore-test.yml` は毎月1日 UTC 03:00 に R2 バックアップから dev DB へのリストアを自動検証します。

> ⚠️ **重要**: リストアテスト実行中は `gh-trends-db-dev`（開発用D1）の全データが**初期化されます**。
> テスト実行中に開発作業を行っている場合、ローカルのデータが失われる可能性があります。
> テスト完了後に dev DB が必要な場合は `npm run db:migrate:dev:remote` で再構築してください。

### リストアテストフロー

```
毎月1日 UTC 03:00（バックアップ取得の1時間後）
  └─ restore-test ジョブ
       ├─ R2 から最新バックアップを検索・ダウンロード
       ├─ gz 解凍
       ├─ dev DB を初期化（全テーブル DROP）
       ├─ バックアップ SQL を dev DB に適用（リストア）
       ├─ 整合性チェックスクリプトを実行（npm run db:check）
       └─ 失敗時: GitHub Issue を自動起票
```

### 必要なシークレット

リストアテストでは以下のシークレットを使用します（バックアップと同じものを流用）：

| シークレット名 | 用途 |
| --- | --- |
| `R2_BACKUP_ACCESS_KEY_ID` | R2 からのダウンロード |
| `R2_BACKUP_SECRET_ACCESS_KEY` | R2 からのダウンロード |
| `CLOUDFLARE_API_TOKEN` | dev D1 への書き込み |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare API |

### 手動実行でテスト

1. GitHub リポジトリの **"Actions"** タブを開く
2. 左サイドバーの **"Monthly D1 Restore Test"** をクリック
3. **"Run workflow"** → **"Run workflow"** をクリック
4. 全ステップが緑になることを確認
5. 失敗した場合は自動的に GitHub Issue が起票されます

### 失敗時の対応

- Workflow ログで失敗したステップを確認する
- [障害対応Runbook](./障害対応Runbook.md) の「バックアップリストア失敗」セクションを参照する
- 手動で `workflow_dispatch` から再実行して確認する

---

## 自動デプロイ（deploy.yml）

`.github/workflows/deploy.yml` は `main` ブランチへの push 時または手動トリガーで自動デプロイを実行します。

### デプロイフロー

```
main へ push
  └─ ci-check（ci.yml の全ジョブをreuse）
       ├─ deploy-backend（並列）
       │    ├─ D1 マイグレーション（npm run db:migrate:prod）
       │    └─ Cloudflare Workers デプロイ（npm run deploy）
       └─ deploy-frontend（並列）
            ├─ Astro ビルド（npm run build）
            └─ Cloudflare Pages デプロイ（wrangler pages deploy）
```

### 必要なシークレット（デプロイ用）

データ収集と同じシークレット（`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）を使用します。

### 手動デプロイ手順（緊急時・CI迂回時）

GitHub Actions を使わずに手動でデプロイする場合：

```bash
# 1. Cloudflare認証を確認
npx wrangler whoami

# 2. Backendデプロイ
cd apps/backend

# D1マイグレーションのdry-run（確認）
npm run db:migrate:prod:dry-run

# D1マイグレーション適用
npm run db:migrate:prod

# Workersデプロイ
npm run deploy

# 3. Frontendデプロイ
cd ../frontend

# ビルド
npm run build

# Cloudflare Pagesへデプロイ
npx wrangler pages deploy dist --project-name=gh-trend-tracker-frontend
```

### Cloudflare Pagesプロジェクトの初回作成

初回デプロイ前に Pages プロジェクトを作成する必要があります：

```bash
# プロジェクト作成（初回のみ）
npx wrangler pages project create gh-trend-tracker-frontend
```

または Cloudflare ダッシュボード（https://dash.cloudflare.com）から「Workers & Pages」→「Create」で作成。

### デプロイ失敗時の確認

- GitHub Actions の **Actions** タブでログを確認
- `deploy-backend` または `deploy-frontend` ジョブが赤くなっていれば失敗
- `ci-check` が失敗している場合は lint/テスト/ビルドエラーを先に修正する
