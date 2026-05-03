# コードスタイルと規約

## 言語設定
- **コメント言語**: 日本語を使用すること（必須）
- **コード**: 英語（変数名、関数名など）

## TypeScript設定

### 厳格モード
- `strict: true`（tsconfig.base.json）
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`

### 型インポート
```typescript
// 推奨: inline type imports
import { type SomeType } from './types';

// 非推奨
import type { SomeType } from './types';
```

### 未使用変数の扱い
- ❌ アンダースコアプレフィックス（`_var`）で回避しない
- ✅ 根本的に解決すること
- ESLint設定: `argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`は例外用

### any型の使用
- `@typescript-eslint/no-explicit-any: 'warn'`
- 可能な限り具体的な型を使用
- テストファイルでは許容

## ESLintルール

### 主要ルール
```javascript
{
  '@typescript-eslint/no-unused-vars': 'error',
  'no-console': 'warn',  // Backend: 'off'
  'prefer-const': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn'
}
```

### Backend（Cloudflare Workers）
- `no-console: 'off'` - ログ出力は許可

### Frontend（React）
- React 17+ JSX Transform使用
- `react/jsx-uses-react: 'off'`
- `react/react-in-jsx-scope: 'off'`
- `react/prop-types: 'off'` - TypeScriptで型チェック

## Prettierフォーマット
- セミコロン: あり
- シングルクォート: 使用
- タブ幅: 2スペース
- 末尾カンマ: es5

## 命名規則

### ファイル名
- コンポーネント: PascalCase（例: `TrendList.tsx`）
- ユーティリティ: camelCase（例: `formatDate.ts`）
- 型定義: camelCase（例: `types.ts`）

### 変数・関数
- camelCase（例: `getUserData`, `totalCount`）

### 定数
- UPPER_SNAKE_CASE（例: `MAX_RESULTS`）

### 型・インターフェース
- PascalCase（例: `UserData`, `ApiResponse`）

## 共有コードの境界ルール

### Backend内のみ: `apps/backend/src/shared/`
- DBクエリ関数
- API固有ユーティリティ
- Backend専用ヘルパー

### Frontend内のみ: `apps/frontend/src/shared/`
- UIユーティリティ
- フォーマッター
- Frontend専用ヘルパー

### 複数アプリ間共有: `shared/src/`
- APIレスポンス型
- 共通エンティティ型
- **判断基準**: 2つ以上のアプリで使用する場合のみ

## データベーススキーマ同期
- ✅ **必須**: `apps/backend/src/db/schema.ts`と`apps/backend/schema/schema.sql`は常に同期
- スキーマ変更時は両方を更新すること

## React/Astro規約

### コンポーネント構造
```typescript
// Props定義
interface ComponentProps {
  title: string;
  count: number;
}

// コンポーネント本体
export function Component({ title, count }: ComponentProps) {
  // ロジック
  return (/* JSX */);
}
```

### Hooks使用
- ルール厳守（`react-hooks/rules-of-hooks`）
- 依存配列の警告に対処（`react-hooks/exhaustive-deps`）

## コミットメッセージ
- プレフィックス使用: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- 日本語でOK
- 例: `feat: ログインUI実装 (scr-011)`

## 制約事項

### 本番環境対応が必要
- ⚠️ CORS: 現在すべてのオリジン許可（本番では制限必要）
- ⚠️ エラーハンドリング: 汎用500エラーを具体化が必要
- ✅ クエリ制限: トレンド100件、履歴90日間に制限済み
