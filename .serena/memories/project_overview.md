# プロジェクト概要

## プロジェクト名
**GitHub Trend Tracker**

## 目的
GitHubリポジトリのトレンドを定量指標として抽出・可視化するWebサービス。
GitHub公式Trendingの24時間/週間/月間区分では詳細な成長推移が見えないため、
エンジニアが技術動向を効率的に把握できるようにする。

## ターゲットユーザー
- エンジニア: 日常的に技術トレンドをチェック
- テックリード: チームへの技術導入判断材料
- ブロガー: 週次/月次の技術トレンド記事のネタ探し
- 技術選定者: 新技術の成長性を定量的に評価

## 技術スタック

### Frontend
- Astro + React
- TypeScript (厳格モード)

### Backend
- Cloudflare Workers + Hono
- Cloudflare D1 (SQLite)
- Drizzle ORM

### 認証・決済（Phase 3）
- GitHub OAuth
- Stripe

### AI機能（Phase 3）
- Claude API / OpenAI API

### 開発環境
- パッケージマネージャ: npm workspaces
- Node バージョン: >= 20.0.0
- ESLint + Prettier
- Vitest (Backend テスト)

## プロジェクト構造
```
gh-trend-tracker/
├── apps/
│   ├── backend/          # Cloudflare Workers API
│   │   ├── src/
│   │   │   ├── routes/   # エンドポイント定義
│   │   │   ├── shared/   # Backend内共通コード
│   │   │   └── db/schema.ts  # Drizzle ORM スキーマ
│   │   └── schema/schema.sql  # D1 SQLスキーマ
│   └── frontend/         # Astro フロントエンド
│       └── src/
├── shared/               # Backend/Frontend間の共有型定義
└── docs/                 # ドキュメント
```

## 現在の開発フェーズ
- **Phase 1 (MVP)**: ✅ 完了
- **Phase 2 (拡張)**: ✅ 完了
- **Phase 3 (収益化)**: 🚧 進行中（GitHub OAuth実装済み、ログインUI実装済み）
