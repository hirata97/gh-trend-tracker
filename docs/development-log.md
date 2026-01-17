# GitHub Trends Tracker 開発ログ

**開発期間**: 2026-01-13 〜 2026-01-14
**目的**: GitHubトレンドを可視化する最小限のMVPを構築

## 実施内容サマリー

### 完成した機能
- ✅ データ収集スクリプト（GitHub API → Cloudflare D1）
- ✅ バックエンドAPI（Cloudflare Workers + Hono）
- ✅ フロントエンド（Astro + React）
- ✅ GitHub Actions自動化（毎日データ収集）

### 技術スタック
- **バックエンド**: Cloudflare Workers, Hono, Drizzle ORM, D1 (SQLite)
- **フロントエンド**: Astro 4.16, React 18, TypeScript
- **自動化**: GitHub Actions
- **パッケージ管理**: npm workspaces

---

## タイムライン

### 1. プロジェクト構造の整理

#### 実施内容
- `api/` ディレクトリを `backend/` にリネーム

#### 理由
- 将来的にデータ収集スクリプトやバッチ処理を追加する予定
- `api` は HTTPエンドポイントのみを指すが、`backend` はサーバーサイド全体を包括

#### 変更ファイル
- ディレクトリ名: `api/` → `backend/`
- `package.json`: workspaces設定を更新
- `CLAUDE.md`, `README.md`: ドキュメント更新

#### コマンド
```bash
git mv api backend
# package.json, CLAUDE.md, README.md を編集
git add .
git commit -m "refactor: rename api directory to backend for future extensibility"
```

---

### 2. バックエンド: データ収集スクリプトの実装

#### 実施内容
GitHub APIから500リポジトリ（10言語×50件）を取得し、D1データベースに保存するスクリプトを作成。

#### ファイル構成
```
backend/
├── scripts/
│   ├── collect-data.ts           # メインスクリプト
│   └── lib/
│       ├── github-client.ts      # GitHub REST API クライアント
│       ├── db-manager.ts         # D1データベース操作
│       └── rate-limiter.ts       # レート制限対応
```

#### 主要機能
1. **GitHub API統合**
   - エンドポイント: `/search/repositories`
   - クエリ: `language:TypeScript created:>YYYY-MM-DD sort:stars`
   - レート制限: 30リクエスト/分

2. **データベース保存**
   - リポジトリ情報: `repositories` テーブル（UPSERT）
   - スナップショット: `repo_snapshots` テーブル（INSERT OR IGNORE）

3. **エラーハンドリング**
   - リトライ機能（最大3回、指数バックオフ）
   - 言語ごとにエラーを分離（1つ失敗しても続行）

#### 実装上の課題と解決

**課題1: `await`を非async関数で使用**
```
Error: "await" can only be used inside an "async" function
```

**解決**: `loadEnv()` 関数内の dynamic import を同期的な import に変更
```typescript
// 修正前
const fs = await import('fs');
const path = await import('path');

// 修正後
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
```

**課題2: データベース保存が非常に遅い（10-20分）**

各リポジトリごとにwranglerコマンドを実行していた（500リポジトリ × 2テーブル = 1000回）

**解決**: 一括保存方式に変更
- 全SQL文を一時ファイル（`.temp-insert.sql`）に書き出し
- 1回のwranglerコマンドで実行
- 完了時間: 10-20分 → **約60秒**

```typescript
// backend/scripts/lib/db-manager.ts
private executeSQLFile(sqlStatements: string[]): void {
  const tempFile = join(process.cwd(), '.temp-insert.sql');
  writeFileSync(tempFile, sqlStatements.join('\n'), 'utf-8');
  execSync(`npx wrangler d1 execute ${dbName} --file=${tempFile} ${flag}`);
  unlinkSync(tempFile);
}
```

#### package.json への追加
```json
{
  "scripts": {
    "collect": "tsx scripts/collect-data.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "@types/node": "^22.10.5"
  }
}
```

#### 実行方法
```bash
cd backend

# Dry run（データベースに保存しない）
npm run collect -- --dry-run

# ローカルD1
npm run collect

# リモートD1
npm run collect -- --remote
```

---

### 3. フロントエンド: Astro + React の実装

#### 実施内容
500リポジトリを表示し、言語でフィルタリングできるシンプルなWebUIを作成。

#### ファイル構成
```
frontend/
├── src/
│   ├── pages/
│   │   └── index.astro              # メインページ
│   ├── components/
│   │   ├── TrendList.tsx            # リポジトリテーブル
│   │   └── LanguageFilter.tsx       # 言語フィルター
│   ├── layouts/
│   │   └── Layout.astro             # ベースレイアウト
│   ├── lib/
│   │   └── api.ts                   # APIクライアント
│   └── styles/
│       └── global.css               # グローバルスタイル
├── public/
│   └── favicon.svg
├── astro.config.mjs
└── tsconfig.json
```

#### 主要機能
1. **サーバーサイドデータ取得**
   - Astroの `Astro.request.url` でクエリパラメータ取得
   - ビルド時/SSR時にバックエンドAPIからデータ取得

2. **言語フィルタリング**
   - ドロップダウンで言語選択
   - `window.location.href` でページリロード（クエリパラメータ付き）

3. **スタイリング**
   - フレームワーク不使用（素のCSS）
   - シンプルなテーブル表示
   - モバイル対応（レスポンシブ）

#### 実装上の課題と解決

**課題: npm依存関係のインストール失敗**
```
npm error ENOTEMPTY: directory not empty
```

**原因**: WSL環境のnpmキャッシュ破損

**解決**:
1. `package-lock.json` を削除
2. ルートから再インストール
```bash
rm package-lock.json
npm install
```

#### package.json の設定
```json
{
  "name": "@gh-trend-tracker/frontend",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "^4.16.0",
    "@astrojs/react": "^3.6.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.6.3"
  }
}
```

#### 環境変数
```env
# frontend/.env
PUBLIC_API_URL=http://localhost:8787
```

---

### 4. データベースのセットアップ

#### ローカルD1データベース

**スキーマ適用**:
```bash
cd backend
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --local
```

**確認**:
```bash
npx wrangler d1 execute gh-trends-db \
  --command="SELECT COUNT(*) FROM repositories" --local
```

#### リモートD1データベース

**データベース作成**:
```bash
npx wrangler d1 create gh-trends-db
```

出力された `database_id` を `backend/wrangler.jsonc` に設定：
```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "gh-trends-db",
      "database_id": "a9fae3bf-ae66-43af-b167-d329c9e7154d"
    }
  ]
}
```

**スキーマ適用**:
```bash
npx wrangler d1 execute gh-trends-db --file=schema/schema.sql --remote
```

#### データベーススキーマ

**repositories テーブル**:
- リポジトリのメタデータ
- `repo_id` (GitHub ID) で一意性保証
- `INSERT OR REPLACE` でupsert

**repo_snapshots テーブル**:
- 日次スナップショット（stars, forks, watchers, open_issues）
- `(repo_id, snapshot_date)` でUNIQUE制約
- `INSERT OR IGNORE` で重複防止

---

### 5. GitHub Actions 自動化の実装

#### 目的
毎日自動的にGitHubトレンドデータを収集し、リモートD1データベースに保存。

#### ワークフローファイル
`.github/workflows/collect-data.yml`:
```yaml
name: Daily GitHub Trends Collection

on:
  schedule:
    - cron: '0 0 * * *'  # 毎日UTC 0:00 (JST 9:00)
  workflow_dispatch:       # 手動実行も可能

jobs:
  collect-data:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Collect data
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TRENDS_TOKEN }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          cd backend
          npm run collect -- --remote
```

#### GitHubシークレットの設定

**必要なシークレット（3つ）**:

1. **GH_TRENDS_TOKEN**
   - GitHub Personal Access Token
   - 取得: https://github.com/settings/tokens
   - Scopes: `public_repo` のみ
   - 値: （GitHubで新規作成し、GitHub Secrets に設定）

2. **CLOUDFLARE_API_TOKEN**
   - Cloudflare API Token
   - 取得: https://dash.cloudflare.com/profile/api-tokens
   - 権限:
     - `Account > D1 > Edit` ⚠️ 重要
     - `Account > Workers Scripts > Edit`
   - Account Resources: 自分のアカウントを選択

3. **CLOUDFLARE_ACCOUNT_ID**
   - Cloudflare Account ID
   - 取得方法: `npx wrangler whoami` で確認
   - 値: `986d40a1e2ae015f128bcf22d436552c`

**設定場所**:
```
GitHub リポジトリ > Settings > Secrets and variables > Actions
```

#### トラブルシューティング

**エラー1: Authentication error [code: 10000]**
```
✘ [ERROR] A request to the Cloudflare API failed.
  Authentication error [code: 10000]
```

**原因**: Cloudflare APIトークンにD1権限がない

**解決**:
- "Edit Cloudflare Workers" テンプレートには `D1:Edit` が含まれていない
- カスタムトークンで `Account > D1 > Edit` を明示的に追加
- トークン再作成後、GitHubシークレット `CLOUDFLARE_API_TOKEN` を更新

**手順**:
1. https://dash.cloudflare.com/profile/api-tokens
2. Create Custom Token
3. Permissions: `D1:Edit`, `Workers Scripts:Edit`
4. Account Resources: 自分のアカウント
5. Create Token → コピー
6. GitHub Secrets で `CLOUDFLARE_API_TOKEN` を更新
7. Actions で "Re-run failed jobs"

**成功確認**:
```
✓ Fetched 500 repos
✓ Saved 500 repos
✓ Data collection complete!
```

---

### 6. ローカル開発環境での動作確認

#### 起動手順

**ターミナル1: バックエンドAPI**
```bash
cd /home/mizuki/projects/gh-trend-tracker
npm run dev:backend
# → http://localhost:8787
```

**ターミナル2: フロントエンド**
```bash
cd /home/mizuki/projects/gh-trend-tracker
npm run dev:frontend
# → http://localhost:4321
```

#### データ収集（初回のみ）
```bash
cd backend
echo "GITHUB_TOKEN=ghp_your_token" > .env
npm run collect
```

#### 動作確認
1. ブラウザで http://localhost:4321 を開く
2. 500リポジトリが表示される
3. 言語フィルタードロップダウンで絞り込み
4. リポジトリ名クリックでGitHubページに遷移

---

## 技術的な学び

### 1. npm workspaces の使い方
- ルートの `package.json` で workspaces を定義
- `npm run dev:backend` のように workspace 経由で実行
- 各サブプロジェクトの `node_modules` は共通化される

### 2. Cloudflare D1 のクセ
- ローカルとリモートでデータベースが分離
- `--local` フラグでローカル、`--remote` でリモート
- リモートD1は非同期、ローカルは同期的
- 一括INSERT時は一時ファイル経由が高速

### 3. GitHub Actions の環境変数
- `secrets.XXX` でシークレット参照
- スクリプト内では `process.env.XXX` でアクセス
- Cloudflare認証は環境変数経由で自動処理

### 4. Astro の特性
- サーバーサイドで初期データ取得可能
- React コンポーネントは `client:load` で有効化
- SSG（Static Site Generation）がデフォルト
- 型安全性: `@shared/types/api` でバックエンドと共有

---

## パフォーマンス最適化

### データベース保存の高速化
- **修正前**: 500リポジトリ × 2テーブル = 1000回のコマンド実行 → 10-20分
- **修正後**: 全SQL文を1ファイルにまとめて実行 → 60秒
- **改善率**: 約10-20倍高速化

### 実装方法
```typescript
// 一時ファイルに全SQL文を書き出し
const sqlStatements = repos.map(repo => [
  generateRepositoryInsert(repo),
  generateSnapshotInsert(repo)
]).flat();

writeFileSync('.temp-insert.sql', sqlStatements.join('\n'));
execSync('npx wrangler d1 execute ... --file=.temp-insert.sql');
unlinkSync('.temp-insert.sql');
```

---

## 残課題・今後の拡張

### 短期的な改善
- [ ] エラー通知（Slack/Discord連携）
- [ ] データ収集の実行時間調整（GitHub API レート制限考慮）
- [ ] フロントエンドのビルド最適化

### 中期的な機能追加
- [ ] 時系列グラフ（Recharts）
- [ ] スター増加率計算（7日間ウィンドウ）
- [ ] リポジトリ詳細ページ
- [ ] 検索・フィルタ機能の強化

### 長期的な展開
- [ ] Cloudflare Pages デプロイ
- [ ] カスタムドメイン設定
- [ ] ユーザー認証（お気に入り機能）
- [ ] メール通知（週次サマリー）

---

## 環境情報

### 開発環境
- **OS**: WSL2 (Ubuntu on Windows)
- **Node.js**: v22.5.0
- **npm**: 10.8.2
- **エディタ**: Claude Code (CLI)

### 本番環境
- **バックエンド**: Cloudflare Workers (無料枠)
- **データベース**: Cloudflare D1 (無料枠: 5GB)
- **自動化**: GitHub Actions (無料枠)
- **フロントエンド**: ローカルのみ（Cloudflare Pages予定）

### コスト
完全無料で運用可能:
- Cloudflare Workers: 10万リクエスト/日
- Cloudflare D1: 500万読み取り/日、10万書き込み/日
- GitHub Actions: 2000分/月（パブリックリポジトリは無制限）

---

## まとめ

### 達成できたこと
1. ✅ GitHub APIから500リポジトリのデータ収集
2. ✅ Cloudflare D1へのデータ保存（ローカル・リモート）
3. ✅ Astro + React でフロントエンド実装
4. ✅ GitHub Actionsで毎日自動データ収集
5. ✅ エンドツーエンドで動作するMVP完成

### 所要時間
- **計画・設計**: 1時間
- **バックエンド実装**: 3時間
- **フロントエンド実装**: 2時間
- **GitHub Actions設定**: 2時間
- **トラブルシューティング**: 1時間
- **合計**: 約9時間

### 最も時間がかかった部分
1. データベース一括保存の最適化（1時間）
2. Cloudflare APIトークンの権限設定（1時間）
3. npm依存関係のインストール問題（30分）

### 振り返り
- MVP開発では「最小限で動くもの」を最優先
- パフォーマンス問題は後から最適化（一括保存で10-20倍高速化）
- GitHub Actionsのシークレット設定は丁寧に確認が必要
- Cloudflare D1は無料で使いやすいが、権限管理に注意

---

**最終更新**: 2026-01-14
**ステータス**: MVP完成、本番稼働中
