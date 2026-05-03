# タスク完了時のチェックリスト

## 1. コード品質チェック

### Lint実行
```bash
npm run lint
```
- エラーがある場合は修正
- 自動修正可能な場合: `npm run lint:fix`

### 型チェック
```bash
npm run type-check
```
- TypeScriptエラーをすべて解消

### フォーマット確認
```bash
npm run format:check
```
- フォーマット違反がある場合: `npm run format`

## 2. テスト実行

### Backend テスト
```bash
npm run test:backend
```
- すべてのテストが通過することを確認
- 新機能には対応するテストを追加

### Frontend テスト
```bash
npm run test:frontend  # Phase 3以降に実装予定
```

## 3. ビルド確認

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
- ビルドエラーがないことを確認

## 4. ドキュメント更新

### API変更時
- [ ] `/docs/設計/API定義.md` を更新
- [ ] OpenAPI仕様書を更新（該当する場合）

### テーブル変更時
- [ ] `/docs/設計/テーブル定義.md` を更新
- [ ] `apps/backend/src/db/schema.ts` を更新
- [ ] `apps/backend/schema/schema.sql` を更新（**必須同期**）

### 画面変更時
- [ ] `/docs/設計/画面一覧.md` を更新

### 要件変更時
- [ ] `/docs/要件定義/機能要件一覧.md` を更新
- [ ] `/docs/基本/ロードマップ.md` を更新

## 5. Git操作

### 変更確認
```bash
git status
git diff
```

### コミット作成
```bash
git add <files>
git commit -m "feat: 機能説明 (要件ID)"
```
- コミットメッセージ規約に従う
- プレフィックス: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

### プッシュ
```bash
git push origin <branch-name>
```

## 6. CI/CD確認

### GitHub Actions
- [ ] テストが通過
- [ ] ビルドが成功
- [ ] Lintエラーなし（`npm run ci:lint`）

## 7. 環境固有の設定確認

### wrangler.jsonc
- [ ] D1データベースIDが環境固有であることを確認
- [ ] 不用意にコミットしないこと

### 環境変数
- [ ] `.dev.vars`（ローカル開発用）
- [ ] Cloudflare Workers Secrets（本番用）

## 8. パフォーマンスチェック（Phase 1完了後）

### フロントエンド
- [ ] LCP < 2秒

### Backend API
- [ ] P95応答時間 < 200ms

### モニタリング
- [ ] 稼働率 99%以上

## 9. セキュリティチェック

### CORS設定
- [ ] 本番環境では特定オリジンのみ許可

### エラーハンドリング
- [ ] 機密情報を含むエラーメッセージを返さない

### レート制限
- [ ] Phase 3で実装予定

## 10. レビュー準備

### プルリクエスト作成
- [ ] タイトル: 明確な変更内容
- [ ] 説明: 何を変更したか、なぜ変更したか
- [ ] 関連Issue番号を記載
- [ ] スクリーンショット（UI変更の場合）

### セルフレビュー
- [ ] 不要なコメントアウトを削除
- [ ] デバッグ用コードを削除
- [ ] console.logを削除（Backend除く）
