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

**次のステップ:**

1. フロントエンドをCloudflare Pagesにデプロイ
2. リモートD1データベースに接続
3. 本番環境でMVP完成！
