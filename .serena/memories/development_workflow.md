# 開発ワークフロー

## 新規機能追加・大規模改修の手順

### 1. 要件確認
- `/docs/要件定義/業務要件一覧.md` で関連する業務要件（req-XXX）を確認
- `/docs/要件定義/機能要件一覧.md` で機能要件（fun-XXX）を確認
- `/docs/要件定義/非機能要件一覧.md` で非機能要件（non-XXX）を確認

### 2. 設計確認
- `/docs/設計/API定義.md` でAPI仕様（bac-XXX）を確認
- `/docs/設計/テーブル定義.md` でDBスキーマ（tab-XXX）を確認
- `/docs/設計/画面一覧.md` で画面設計（scr-XXX）を確認

### 3. フェーズ確認
- `/docs/基本/ロードマップ.md` で実装対象のPhaseを確認
- Phase 1（MVP）が最優先
- Phase 2（拡張）は次点
- Phase 3（収益化）は将来計画

### 4. ブランチ作成
```bash
git checkout -b feature/issue-XX-description
```
- 命名規則: `feature/issue-<番号>-<説明>`
- 例: `feature/issue-94-performance-optimization`

### 5. 実装
- `/docs/基本/開発ガイド.md` のコーディング規約に従う
- `/docs/基本/アーキテクチャ.md` でシステム構成を理解
- 共有コードの境界ルールを遵守
  - Backend内のみ: `apps/backend/src/shared/`
  - Frontend内のみ: `apps/frontend/src/shared/`
  - 複数アプリ間: `shared/src/`

### 6. テスト追加
- 新機能には対応するテストを追加
- Backend: Vitestを使用
- テストファイル: `*.test.ts`

### 7. ドキュメント更新
- API変更時: `/docs/設計/API定義.md` を更新
- テーブル変更時: `/docs/設計/テーブル定義.md` と両スキーマファイルを更新
- 画面変更時: `/docs/設計/画面一覧.md` を更新

### 8. 品質チェック
```bash
npm run lint:fix      # Lint自動修正
npm run format        # フォーマット
npm run type-check    # 型チェック
npm run test:backend  # テスト実行
npm run build         # ビルド確認
```

### 9. コミット
```bash
git add .
git commit -m "feat: 機能説明 (要件ID)"
```

### 10. プッシュ＆プルリクエスト
```bash
git push origin feature/issue-XX-description
```
- GitHub上でプルリクエスト作成
- 関連Issue番号を記載
- レビュワーをアサイン

## 要件ID体系

### 業務要件（34件）
- `req-XXX`: ビジネス要件
- 例: `req-001` - トレンドランキング表示

### 機能要件（54件）
- `fun-XXX`: 機能仕様
- 例: `fun-016` - リポジトリ名検索

### 非機能要件（16件）
- `non-XXX`: パフォーマンス、セキュリティなど
- 例: `non-001` - LCP 2秒以内

### API定義（14件）
- `bac-XXX`: Backend APIエンドポイント
- 例: `bac-011` - 日次データ収集バッチ

### 画面定義（11件）
- `scr-XXX`: 画面仕様
- 例: `scr-011` - ログイン画面

## 主要APIエンドポイント

### 閲覧系
- `GET /health` - ヘルスチェック
- `GET /api/languages` - 言語一覧
- `GET /api/trends/daily` - 日次トレンドランキング（ソート・ページネーション対応）
- `GET /api/repositories/:repoId` - リポジトリ詳細＋90日間スター推移
- `GET /api/repositories/search` - リポジトリ名検索
- `GET /api/trends/weekly` - 週別トレンドランキング
- `GET /api/trends/weekly/available-weeks` - 利用可能な週一覧

### バッチ処理系（GitHub Actions専用）
- `POST /api/internal/batch/collect-daily` - 日次データ収集（bac-011）
- `POST /api/internal/batch/calculate-metrics` - メトリクス計算（bac-012）
- `POST /api/internal/batch/calculate-weekly` - 週別トレンド集計（bac-013）

### 認証系（Phase 3）
- `GET /api/auth/callback/github` - GitHub OAuth コールバック（bac-006）
- `POST /api/auth/logout` - ログアウト

## 成功指標

### パフォーマンス
- LCP: 2秒以内
- API応答時間: P95 200ms以内

### 可用性
- 稼働率: 99%以上

### コード品質
- Lint警告: 0件（CI）
- 型エラー: 0件
- テストカバレッジ: 段階的に向上
