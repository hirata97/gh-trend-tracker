# Cloudflare D1 + Astro で作る GitHub トレンド可視化アプリ【完全無料】

## はじめに

技術選定や学習の優先順位を決める際、「今どんなリポジトリがトレンドなのか？」を知りたいことはありませんか？

本記事では、**GitHub APIから自動的にトレンドデータを収集し、Webで可視化するアプリケーション**を1日で構築した過程を紹介します。全て無料枠で運用可能で、サーバーレスアーキテクチャを採用しています。

### 完成したもの

- ✅ 毎日500リポジトリ（10言語×50件）を自動収集
- ✅ 言語フィルタリング機能付きWebUI
- ✅ GitHub Actionsで完全自動化
- ✅ 運用コスト: **完全無料**

### デモ

![GitHub Trends Tracker スクリーンショット（想定）]

- リポジトリ一覧をテーブル表示
- ドロップダウンで言語フィルタリング
- スター数、説明文を表示

## 技術スタック

### バックエンド
- **Cloudflare Workers**: サーバーレスランタイム
- **Hono**: 軽量Webフレームワーク
- **Cloudflare D1**: サーバーレスSQLiteデータベース
- **Drizzle ORM**: TypeScript ORM

### フロントエンド
- **Astro 4**: 静的サイトジェネレーター
- **React 18**: UIコンポーネント
- **TypeScript**: 型安全性

### 自動化
- **GitHub Actions**: 日次データ収集

### パッケージ管理
- **npm workspaces**: モノレポ構成

### なぜこの構成？

1. **完全無料で運用可能**
   - Cloudflare Workers/D1の無料枠が非常に寛容
   - GitHub Actionsもパブリックリポジトリなら無制限

2. **サーバーレスでメンテナンスフリー**
   - サーバー管理不要
   - スケーリング自動

3. **TypeScriptで型安全**
   - バックエンドとフロントエンドで型を共有
   - 開発体験が良い

---

## アーキテクチャ概要

```
┌─────────────────────┐
│  GitHub Actions     │ 毎日UTC 0:00実行
│  (データ収集)        │
└──────┬──────────────┘
       │
       ↓ GitHub API
┌─────────────────────┐
│  GitHub API         │ トレンドリポジトリ取得
│  /search/repos      │ 500件/日
└──────┬──────────────┘
       │
       ↓ 保存
┌─────────────────────┐
│  Cloudflare D1      │ SQLiteデータベース
│  (repositories +    │ スナップショット方式
│   repo_snapshots)   │
└──────┬──────────────┘
       │
       ↓ 読み取り
┌─────────────────────┐
│  Cloudflare Workers │ Hono API
│  (Hono API)         │ /api/trends
└──────┬──────────────┘
       │
       ↓ 取得
┌─────────────────────┐
│  Astro + React      │ フロントエンド
│  (Frontend)         │ http://localhost:4321
└─────────────────────┘
```

### データフロー

1. **データ収集**: GitHub Actions → GitHub API → D1
2. **データ取得**: Frontend → Workers API → D1
3. **頻度**: 収集は1日1回、表示はリアルタイム

---

## 実装の全工程

開発時間: **約9時間** (1日)

### 1. プロジェクト構造の設計

モノレポ構成を採用し、バックエンド・フロントエンドを明確に分離。

```
gh-trend-tracker/
├── backend/                    # Cloudflare Workers API
│   ├── src/
│   │   ├── routes/            # エンドポイント
│   │   ├── db/schema.ts       # Drizzle ORM
│   │   └── index.ts
│   ├── scripts/
│   │   ├── collect-data.ts    # データ収集スクリプト
│   │   └── lib/               # ユーティリティ
│   └── wrangler.jsonc
├── frontend/                   # Astro フロントエンド
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── lib/
│   └── astro.config.mjs
├── shared/                     # 共通型定義
│   └── types/api.ts
└── package.json                # ワークスペース管理
```

#### ディレクトリ命名の意図

当初は `api/` という名前でしたが、将来的にデータ収集スクリプトやバッチ処理を追加する予定だったため、`backend/` にリネームしました。

- `api` = HTTPエンドポイントのみ
- `backend` = サーバーサイド全体（API + バッチ処理）

```bash
git mv api backend
```

---

## 2. データ収集スクリプトの実装

### 2-1. GitHub API統合

GitHub REST APIの `/search/repositories` エンドポイントを使用。

**検索クエリ例**:
```
language:TypeScript created:>2025-12-01 sort:stars
```

- 直近1ヶ月に作成されたリポジトリ
- スター数でソート
- 言語で絞り込み

**対象言語（10言語）**:
- TypeScript, JavaScript, Python, Go, Rust
- Java, C++, Ruby, PHP, Swift

**取得数**: 各言語50件 × 10言語 = 500リポジトリ/日

### 2-2. レート制限対応

GitHub APIの検索エンドポイントは **30リクエスト/分** の制限があります。

```typescript
// backend/scripts/lib/rate-limiter.ts
export class RateLimiter {
  private lastRequestTime = 0;
  private minInterval: number;

  constructor(requestsPerMinute: number = 30) {
    this.minInterval = (60 * 1000) / requestsPerMinute;
  }

  async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minInterval) {
      const sleepTime = this.minInterval - timeSinceLastRequest;
      await this.sleep(sleepTime);
    }

    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 2-3. データベース設計

スナップショット方式を採用し、日次でリポジトリの指標を記録。

**repositories テーブル**:
```sql
CREATE TABLE repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER UNIQUE NOT NULL,  -- GitHub ID
  name TEXT NOT NULL,
  full_name TEXT UNIQUE NOT NULL,
  owner TEXT NOT NULL,
  language TEXT,
  description TEXT,
  html_url TEXT NOT NULL,
  topics TEXT,  -- JSON文字列
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**repo_snapshots テーブル**:
```sql
CREATE TABLE repo_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id INTEGER NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  watchers INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  snapshot_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(repo_id, snapshot_date)  -- 1日1スナップショット
);
```

**設計のポイント**:
- `repositories`: `INSERT OR REPLACE` でupsert
- `repo_snapshots`: `INSERT OR IGNORE` で重複防止
- 将来的にスター増加率を計算可能

---

## 3. 最大の課題: データベース保存の高速化

### 問題発生

初期実装では、各リポジトリごとにwranglerコマンドを実行していました。

```typescript
// ❌ 非効率な実装
for (const repo of repos) {
  execSync(`npx wrangler d1 execute ... --command="INSERT ..."`);
  execSync(`npx wrangler d1 execute ... --command="INSERT ..."`);
}
```

**実行時間**: 500リポジトリ × 2テーブル = 1000回のコマンド実行 → **10-20分**

### 解決策: 一括保存

全SQL文を一時ファイルに書き出し、1回のwranglerコマンドで実行。

```typescript
// ✅ 改善後の実装
export class DatabaseManager {
  private executeSQLFile(sqlStatements: string[]): void {
    const tempFile = join(process.cwd(), '.temp-insert.sql');

    try {
      // 全SQL文を一時ファイルに書き出し
      writeFileSync(tempFile, sqlStatements.join('\n'), 'utf-8');

      // 1回のコマンドで実行
      const command = `npx wrangler d1 execute ${this.config.databaseName} --file=${tempFile} ${flag}`;
      execSync(command, { stdio: 'inherit' });

      // クリーンアップ
      unlinkSync(tempFile);
    } catch (error) {
      unlinkSync(tempFile);
      throw error;
    }
  }

  async saveRepos(repos: GitHubRepo[]): Promise<Result> {
    const sqlStatements: string[] = [];

    for (const repo of repos) {
      sqlStatements.push(this.generateRepositoryInsert(repo));
      sqlStatements.push(this.generateSnapshotInsert(repo, snapshotDate));
    }

    this.executeSQLFile(sqlStatements);
    return { success: repos.length, failed: 0 };
  }
}
```

### パフォーマンス改善結果

- **修正前**: 10-20分
- **修正後**: **約60秒**
- **改善率**: 約10-20倍高速化 🚀

---

## 4. フロントエンドの実装

### 4-1. Astro + React の選定理由

- **Astro**: サーバーサイドで初期データ取得、SSG/SSRに対応
- **React**: クライアントサイドの動的な部分のみ

**部分的ハイドレーション**:
```astro
---
// src/pages/index.astro
import TrendList from '../components/TrendList';
import { getTrends } from '../lib/api';

const trends = await getTrends();  // サーバーサイド
---

<Layout>
  <TrendList
    initialTrends={trends}
    client:load  // クライアントサイドで有効化
  />
</Layout>
```

### 4-2. 言語フィルタリング

シンプルなドロップダウンで実装。

```tsx
// src/components/LanguageFilter.tsx
export default function LanguageFilter({ languages }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const language = e.target.value;

    if (language === '') {
      window.location.href = '/';
    } else {
      window.location.href = `/?language=${encodeURIComponent(language)}`;
    }
  };

  return (
    <select onChange={handleChange}>
      <option value="">All Languages</option>
      {languages.map((lang) => (
        <option key={lang} value={lang}>{lang}</option>
      ))}
    </select>
  );
}
```

**クエリパラメータでフィルタリング**:
- `/?language=TypeScript` → TypeScriptのみ表示
- `/` → 全言語表示

### 4-3. スタイリング

フレームワークを使わず、素のCSSでシンプルに。

```css
/* src/styles/global.css */
body {
  font-family: system-ui, sans-serif;
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  text-align: left;
  padding: 0.75rem;
  border-bottom: 1px solid #e1e4e8;
}

tr:hover {
  background: #f6f8fa;
}
```

---

## 5. GitHub Actions 自動化

### 5-1. ワークフロー設定

毎日UTC 0:00（日本時間 9:00）に自動実行。

```yaml
# .github/workflows/collect-data.yml
name: Daily GitHub Trends Collection

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:  # 手動実行も可能

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

      - name: Collect GitHub trends data
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TRENDS_TOKEN }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          cd backend
          npm run collect -- --remote
```

### 5-2. シークレットの設定

**必要なシークレット（3つ）**:

| シークレット名 | 用途 | 取得方法 |
|---|---|---|
| `GH_TRENDS_TOKEN` | GitHub API アクセス | https://github.com/settings/tokens <br> Scopes: `public_repo` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API アクセス | https://dash.cloudflare.com/profile/api-tokens <br> 権限: `D1:Edit`, `Workers Scripts:Edit` |
| `CLOUDFLARE_ACCOUNT_ID` | アカウント識別子 | `npx wrangler whoami` で確認 |

**設定場所**:
```
GitHub リポジトリ > Settings > Secrets and variables > Actions
```

---

## 6. トラブルシューティング

開発中に遭遇した問題と解決方法を紹介します。

### 問題1: `await` を非async関数で使用

**エラー**:
```
Error: "await" can only be used inside an "async" function
```

**原因**: 環境変数読み込みで dynamic import を使用していた

```typescript
// ❌ 問題のあるコード
function loadEnv() {
  const fs = await import('fs');  // await in non-async function
  const path = await import('path');
  // ...
}
```

**解決**: 同期的な import に変更

```typescript
// ✅ 修正後
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function loadEnv() {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    // ...
  }
}
```

### 問題2: Cloudflare認証エラー

**エラー**:
```
✘ [ERROR] Authentication error [code: 10000]
```

**原因**: Cloudflare APIトークンにD1の権限がない

Cloudflareの **"Edit Cloudflare Workers"** テンプレートには、`D1:Edit` 権限が含まれていません。

**解決**: カスタムトークンで明示的に権限追加

1. https://dash.cloudflare.com/profile/api-tokens
2. **Create Custom Token**
3. Permissions:
   - ✅ `Account > D1 > Edit`
   - ✅ `Account > Workers Scripts > Edit`
4. Account Resources: 自分のアカウントを選択
5. トークンを作成 → GitHubシークレットを更新

### 問題3: npm依存関係のインストール失敗

**エラー**:
```
npm error ENOTEMPTY: directory not empty
```

**原因**: WSL環境でnpmキャッシュが破損

**解決**:
```bash
rm package-lock.json
npm install
```

---

## 技術的な学びとベストプラクティス

### 1. Cloudflare D1のクセ

**ローカルとリモートの分離**:
```bash
# ローカルD1（開発用）
npx wrangler d1 execute gh-trends-db --command="SELECT ..." --local

# リモートD1（本番用）
npx wrangler d1 execute gh-trends-db --command="SELECT ..." --remote
```

**一括INSERTの高速化**:
- コマンド実行のオーバーヘッドが大きい
- SQLファイル経由が圧倒的に速い

### 2. npm workspaces の活用

モノレポでサブプロジェクトを管理。

```json
// ルートpackage.json
{
  "workspaces": ["shared", "backend", "frontend"],
  "scripts": {
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend"
  }
}
```

**メリット**:
- 依存関係を一元管理
- 共通のnode_modules
- 型定義を共有可能

### 3. 型安全な開発

バックエンドとフロントエンドで型を共有。

```typescript
// shared/types/api.ts
export interface TrendItem {
  repoId: number;
  fullName: string;
  language: string | null;
  currentStars: number;
  description: string | null;
  htmlUrl: string;
}

export interface TrendsResponse {
  trends: TrendItem[];
}
```

```typescript
// frontend/src/lib/api.ts
import type { TrendsResponse } from '@shared/types/api';

export async function getTrends(): Promise<TrendsResponse> {
  const response = await fetch(`${API_BASE}/api/trends`);
  return response.json();  // 型安全
}
```

---

## パフォーマンスとコスト

### 実行時間

| 処理 | 時間 |
|---|---|
| データ収集（500リポジトリ） | 約20秒 |
| データベース保存 | 約60秒 |
| 合計 | **約80秒/日** |

### 無料枠の余裕度

**Cloudflare Workers**:
- 制限: 10万リクエスト/日
- 使用: 数百リクエスト/日（API呼び出し）
- **余裕度: 99%以上**

**Cloudflare D1**:
- 制限: 500万読み取り/日、10万書き込み/日
- 使用: 1000書き込み/日、数千読み取り/日
- **余裕度: 99%以上**

**GitHub Actions**:
- 制限: パブリックリポジトリは無制限
- 使用: 約2分/日
- **余裕度: 無制限**

### 実質的なコスト

**完全無料で運用可能** 🎉

---

## 今後の拡張案

### 短期的な改善
- エラー通知（Slack/Discord連携）
- データ収集時間の最適化
- フロントエンドのビルド最適化

### 中期的な機能追加
- 時系列グラフ（Recharts）でスター推移を可視化
- 7日間のスター増加率計算
- リポジトリ詳細ページ
- 検索・フィルタ機能の強化

### 長期的な展開
- Cloudflare Pages へのデプロイ
- カスタムドメイン設定
- ユーザー認証とお気に入り機能
- 週次サマリーのメール通知

---

## まとめ

### 達成できたこと

1. ✅ GitHub APIから毎日500リポジトリを自動収集
2. ✅ Cloudflare D1にスナップショット方式でデータ保存
3. ✅ Astro + Reactで言語フィルタリング可能なWebUI
4. ✅ GitHub Actionsで完全自動化
5. ✅ **完全無料で運用可能なMVP完成**

### 開発時間

- **計画・設計**: 1時間
- **バックエンド実装**: 3時間
- **フロントエンド実装**: 2時間
- **GitHub Actions設定**: 2時間
- **トラブルシューティング**: 1時間
- **合計**: **約9時間（1日）**

### 学んだこと

1. **MVP開発では「最小限で動くもの」を最優先**
   - パフォーマンス問題は後から最適化
   - 一括保存で10-20倍高速化を達成

2. **サーバーレスの威力**
   - インフラ管理不要
   - スケーリング自動
   - 無料枠が非常に寛容

3. **型安全性の重要性**
   - バックエンドとフロントエンドで型共有
   - 開発効率が大幅に向上

4. **自動化による運用負荷の削減**
   - GitHub Actionsで完全自動化
   - 手動作業ゼロ

---

## リポジトリ

完全なソースコードはGitHubで公開しています：

**https://github.com/hirata97/gh-trend-tracker**

- ⭐ スターしていただけると嬉しいです！
- 🐛 Issue・PRも歓迎です

---

## 参考リンク

- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [Astro ドキュメント](https://docs.astro.build/)
- [Hono ドキュメント](https://hono.dev/)
- [GitHub REST API](https://docs.github.com/en/rest)

---

**著者**: hirata97
**公開日**: 2026-01-14
**タグ**: #Cloudflare #Astro #React #TypeScript #サーバーレス #GitHub
