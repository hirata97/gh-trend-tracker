# よく使うコマンド一覧

## 開発サーバー起動

### Backend API（http://localhost:8787）
```bash
npm run dev:backend
```

### Frontend Web（http://localhost:4321）
```bash
npm run dev:frontend
```

## ビルド

### Backend ビルド
```bash
npm run build:backend
```

### Frontend ビルド
```bash
npm run build:frontend
```

### 全体ビルド
```bash
npm run build
```

## デプロイ

### Backend デプロイ（Cloudflare Workers）
```bash
npm run deploy:backend
```

### Frontend デプロイ（Cloudflare Pages）
```bash
npm run deploy:frontend
```

## テスト

### Backend テスト実行
```bash
npm run test:backend
```

### 全体テスト実行
```bash
npm run test
```

## コード品質チェック

### Lint実行
```bash
npm run lint
```

### Lint自動修正
```bash
npm run lint:fix
```

### CI用Lint（警告0件を強制）
```bash
npm run ci:lint
```

### 型チェック
```bash
npm run type-check
```

### フォーマット実行
```bash
npm run format
```

### フォーマットチェック
```bash
npm run format:check
```

## データ収集（バッチ処理）

### GitHub APIからデータ収集
```bash
cd apps/backend && npm run collect
```

## Git操作

### ブランチ一覧確認
```bash
git branch -a
```

### コミット履歴確認
```bash
git log --oneline --graph --all --decorate -20
```

### 変更状態確認
```bash
git status
```

## システムユーティリティ（Linux）

### ファイル一覧表示
```bash
ls -la
```

### ディレクトリ移動
```bash
cd <path>
```

### ファイル検索
```bash
find . -name "*.ts"
```

### コンテンツ検索
```bash
grep -r "pattern" .
```
