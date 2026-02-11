# モノレポ構成における shared ディレクトリの必要性と代替戦略の検討

> Issue: #115
> 調査日: 2026-02-11

## 1. 現状分析

### 1.1 shared/ パッケージの内容

`shared/` パッケージには**型定義ファイルのみ**が存在する。

| ファイル | 内容 | エクスポート数 |
|----------|------|----------------|
| `shared/src/types/repository.ts` | リポジトリ・スナップショット・メトリクス・言語の型定義 | 4型 |
| `shared/src/types/api.ts` | APIレスポンス・リクエスト関連の型定義 | 27型 |
| `shared/src/index.ts` | 上記のバレルエクスポート | 31型 |

**ランタイムコードはゼロ。** すべてが `interface` / `type` であり、コンパイル後のJavaScriptには一切残らない。

### 1.2 インポート状況

| 消費元 | ファイル数 | インポート形式 |
|--------|-----------|----------------|
| Backend（ルート・サービス） | 14ファイル | すべて `import type` |
| Backend テスト | 1ファイル | `import type` |
| Frontend（コンポーネント・ページ・lib） | 11ファイル | すべて `import type` |
| **合計** | **26ファイル** | **100% `import type`** |

**重要な発見:** `import type` はTypeScriptコンパイル時にすべて消去される。`shared/` パッケージはランタイムの依存関係を一切生み出していない。

### 1.3 apps/backend/src/shared/ との混同リスク

プロジェクトには2つの「shared」が存在する:

| パス | 役割 | 内容 |
|------|------|------|
| `shared/` (ワークスペース) | Backend/Frontend間の型共有 | 型定義のみ |
| `apps/backend/src/shared/` | Backend内の共通コード | ランタイムコード（queries, errors, utils, constants） |

名前は似ているが役割は完全に異なる。今回の調査対象はワークスペースレベルの `shared/` のみ。

### 1.4 tsconfig paths の不整合

両アプリのtsconfigに**誤ったパス**が設定されている:

```json
// apps/backend/tsconfig.json & apps/frontend/tsconfig.json
"paths": {
  "@gh-trend-tracker/shared": ["../../packages/shared-types/src"]
}
```

`../../packages/shared-types/src` は存在しない。実際のモジュール解決はnpm workspacesのsymlink（`node_modules/@gh-trend-tracker/shared -> ../../shared`）経由で動作しているため問題は顕在化していないが、修正すべき。

## 2. 代替案の評価

### 案1: 現状維持（shared ディレクトリ継続使用）

**メリット:**
- 型定義の一元管理（DRY原則）
- TypeScriptの型チェックにより整合性を保証
- 変更時に両アプリのビルドが壊れるため、不整合を即座に検知
- 開発者は1箇所だけ更新すればよい

**デメリット:**
- npm workspaces固有の設定コスト（symlink、workspace protocol）
- 新規開発者にとって構造の理解コスト
- tsconfig pathsの設定が必要

**デプロイへの影響:** なし。`import type` はすべてコンパイル時に消えるため、独立デプロイに支障なし。

### 案2: OpenAPI / 型生成ツールの活用

**メリット:**
- APIスキーマから型を自動生成（Backend → Frontend）
- ランタイムバリデーション（Zodスキーマ等）も同時に生成可能
- Backend/Frontendの完全独立ビルド
- API仕様と型定義の乖離防止

**デメリット:**
- 型生成パイプラインの構築・保守コスト
- 生成ファイルのgit管理方針の決定が必要
- 現在のOpenAPI仕様（`openapi.yaml`）のメンテナンス負荷が増加
- Backendが使用する型（バッチレスポンス型など）はOpenAPI経由では提供しにくい
- 現在のプロジェクト規模（31型）に対してオーバーキル

**デプロイへの影響:** 完全独立デプロイ可能だが、型生成CIステップが必要。

### 案3: 型定義の重複定義（Backend/Frontend各自で定義）

**メリット:**
- 各アプリが完全に独立
- workspace設定・symlink不要でシンプル
- 必要な型のみ保持できる

**デメリット:**
- **DRY原則の重大な違反** — 31型の二重管理
- API変更時に両方の更新を忘れるリスク（型不整合バグの温床）
- 型名・構造が徐々に乖離する危険性
- コードレビューの負荷増加（変更漏れチェック）

**デプロイへの影響:** 完全独立だが、型の同期は人力に依存。

### 案4: パッケージレジストリへの公開

**メリット:**
- バージョニングにより破壊的変更を管理
- 完全独立ビルド・デプロイ
- 外部消費者への公開も可能

**デメリット:**
- npmプライベートレジストリの設定・コスト（npm Pro or GitHub Packages）
- パブリッシュのワークフロー整備が必要
- 型定義変更のたびにバージョンアップ→各アプリで更新のサイクル
- 現在のプロジェクト規模（開発者1名・31型）に対して明らかにオーバーキル
- 開発速度の低下（型変更→公開→更新→確認のサイクル）

**デプロイへの影響:** 完全独立だが、運用コスト大。

## 3. 比較表

| 評価項目 | 案1: 現状維持 | 案2: OpenAPI型生成 | 案3: 重複定義 | 案4: レジストリ |
|----------|:---:|:---:|:---:|:---:|
| DRY原則 | ◎ | ◎ | ✕ | ◎ |
| 型安全性 | ◎ | ◎ | △ | ○ |
| 設定の簡潔さ | ○ | △ | ◎ | ✕ |
| 独立デプロイ | ◎ ※1 | ◎ | ◎ | ◎ |
| 導入コスト | ◎ (既存) | ✕ | △ | ✕ |
| 保守コスト | ○ | △ | ✕ | ✕ |
| スケーラビリティ | ○ | ◎ | ✕ | ◎ |
| **プロジェクト規模適合** | **◎** | **△** | **✕** | **✕** |

※1 `import type` のみのため、ランタイム依存なし。デプロイの結合は存在しない。

## 4. 推奨アプローチ

### 結論: **案1（現状維持）+ 軽微な改善**

#### 根拠

1. **デプロイ結合の懸念は杞憂**
   - `shared/` からのインポートは100% `import type` であり、コンパイル後にはすべて消える
   - Cloudflare Workers（wrangler）もAstroビルドも、ローカルのTypeScriptファイルをバンドルするため、`shared/` はビルド時にのみ参照され、デプロイアーティファクトには含まれない
   - Backend/Frontendは**既に独立デプロイ可能**

2. **プロジェクト規模に適合**
   - 開発者1名、型定義31個、ファイル3つの規模でOpenAPI型生成やパッケージレジストリは過剰投資
   - 現在の構成は「ちょうどよい複雑さ」

3. **型の一元管理は不整合バグの最良の防波堤**
   - API型の重複定義は、経験上必ず乖離する
   - 型チェックによる自動検知が最もコストの低い品質保証手段

4. **将来のスケールパスが明確**
   - Phase 3でAPI規模が拡大した場合、案2（OpenAPI型生成）への移行は容易
   - 現時点で過剰投資する必要はない

#### 推奨する軽微な改善

| 改善項目 | 内容 | 優先度 |
|----------|------|--------|
| tsconfig paths修正 | `../../packages/shared-types/src` → `../../shared/src` に修正 | 高（バグ予防） |
| ドキュメント整理 | `shared/` と `apps/*/src/shared/` の違いをREADMEに明記 | 中 |

## 5. 次のアクション

- [x] 調査結果の文書化（本ドキュメント）
- [ ] tsconfig pathsの修正（別Issue推奨: 影響範囲が限定的なため小タスク）
- [ ] 将来的にAPI規模が拡大した場合（目安: 型定義100+）、OpenAPI型生成への移行を再検討

## 6. 参考

- [Cloudflare Workers デプロイドキュメント](https://developers.cloudflare.com/workers/)
- [npm workspaces ドキュメント](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [TypeScript `import type` の仕様](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)
