# Dev Container セットアップガイド

> **配置**: `.devcontainer/` - Docker & VS Code Dev Container設定

## 概要

このガイドでは、GitHub Trend TrackerプロジェクトのVS Code Dev Containerのセットアップと使用方法について説明します。

## 必要な条件

- Docker Desktop 4.0 以上
- VS Code + Dev Containers拡張機能（`ms-vscode-remote.remote-containers`）
- Git

## クイックスタート

### 1. VS Codeでコンテナを開く

1. VS Codeでプロジェクトを開く
2. コマンドパレット（Ctrl+Shift+P / Cmd+Shift+P）を開く
3. `Dev Containers: Reopen in Container` を実行
4. 初回は自動的にDockerイメージをビルド

### 2. 開発開始

コンテナ起動後、以下のコマンドが利用可能：

```bash
# API開発サーバー起動
npm run dev:backend

# フロントエンド開発サーバー起動（実装後）
npm run dev:frontend

# テスト実行
npm run test:backend

# Claude Code CLI起動
claude

# Cloudflare認証確認
wrangler whoami
```

## アクセスURL

| サービス | URL | 説明 |
|----------|-----|------|
| Wrangler (API) | http://localhost:8787 | Cloudflare Workers開発サーバー |
| Astro (Frontend) | http://localhost:4321 | フロントエンド開発サーバー（予定） |

## インストール済みツール

| ツール | 用途 |
|--------|------|
| Node.js 20 | JavaScript実行環境 |
| Wrangler CLI | Cloudflare Workers/D1管理 |
| GitHub CLI | GitHub操作 |
| Claude Code | AI支援開発 |
| uv | Serena MCP用Python環境 |
| Docker CLI | コンテナ操作 |

## ディレクトリ構造

```
.devcontainer/
├── README.md           # このファイル
├── devcontainer.json   # VS Code Dev Container設定
├── Dockerfile          # コンテナイメージ定義
└── start.sh            # 起動時スクリプト
```

## VS Code拡張機能

コンテナ起動時に以下の拡張機能が自動インストールされます：

- **Astro** - Astroフレームワークサポート
- **ESLint** - コード品質チェック
- **Prettier** - コードフォーマット
- **GitLens** - Git機能強化
- **Tailwind CSS IntelliSense** - Tailwind CSS補完
- **Docker** - Docker操作

## Cloudflare認証

Wranglerを使用するにはCloudflare認証が必要です：

```bash
# 認証（ブラウザが開きます）
wrangler login

# 認証状態確認
wrangler whoami
```

## トラブルシューティング

### コンテナが起動しない

```bash
# Dockerが起動しているか確認
docker info

# 古いコンテナを削除して再ビルド
docker rm -f gh-trend-tracker-dev-container
# VS Codeで「Rebuild Container」を実行
```

### node_modulesの問題

```bash
# ボリュームを削除して再インストール
docker volume rm gh-trend-tracker-node-modules
# VS Codeで「Rebuild Container」を実行
```

### Wranglerが認証エラーになる

```bash
# 再認証
wrangler logout
wrangler login
```

## 参考資料

- [VS Code Dev Containers](https://code.visualstudio.com/docs/devcontainers/containers)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Claude Code](https://claude.ai/code)
