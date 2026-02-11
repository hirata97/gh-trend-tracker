# API定義

バックエンドAPIエンドポイントの設計を定義する。

## エンドポイント一覧

| ID      | 分類     | メソッド | パス                                        | 概要                                     |
| ------- | -------- | -------- | ------------------------------------------- | ---------------------------------------- |
| bac-001 | 閲覧     | GET      | /api/trends/daily                           | 日次トレンドランキング一覧取得           |
| bac-002 | 閲覧     | GET      | /api/repositories/{repoId}                  | リポジトリ詳細情報と90日間スター推移取得 |
| bac-003 | 検索     | GET      | /api/repositories/search                    | リポジトリ名検索実行                     |
| bac-004 | 週別分析 | GET      | /api/trends/weekly                          | 週別トレンドランキング取得               |
| bac-005 | 週別分析 | GET      | /api/trends/weekly/available-weeks          | 閲覧可能な過去週リスト取得               |
| bac-006 | 認証     | GET      | /api/auth/callback/github                   | GitHub OAuth認証コールバック処理         |
| bac-007 | AI機能   | GET      | /api/repositories/{repoId}/summary          | リポジトリAI要約取得                     |
| bac-008 | AI機能   | POST     | /api/repositories/{repoId}/summary/generate | AI要約オンデマンド生成要求               |
| bac-009 | 課金     | POST     | /api/billing/checkout                       | Stripe Checkoutセッション生成            |
| bac-010 | 課金     | POST     | /api/webhook/stripe                         | Stripe Webhook決済イベント処理           |
| bac-011 | バッチ   | POST     | /api/internal/batch/collect-daily           | 日次データ収集＆スナップショット保存     |
| bac-012 | バッチ   | POST     | /api/internal/batch/calculate-metrics       | 7日間/30日間スター増加率計算             |
| bac-013 | バッチ   | POST     | /api/internal/batch/calculate-weekly        | 週別トレンド集計とランキング保存         |
| bac-014 | バッチ   | POST     | /api/internal/batch/generate-ai             | 週別トップリポジトリAI要約自動生成       |

---

## bac-001: 日次トレンドランキング一覧取得

指定された言語、ソート基準、ページ番号に基づいて、リポジトリの日次トレンドランキング一覧（最大100件）を取得する。

- **メソッド**: GET
- **パス**: `/api/trends/daily`
- **ファイル名**: `trends-daily.ts`
- **関連画面**: [scr-001](./画面一覧.md#scr-001-トレンド一覧画面-日次)
- **関連機能**: fun-001, fun-002, fun-004, fun-005, fun-007, fun-008, fun-009, fun-010, fun-053

### パラメータ

| 名前     | 位置  | 型      | 必須 | 説明                                                                            |
| -------- | ----- | ------- | ---- | ------------------------------------------------------------------------------- |
| language | query | string  | No   | フィルタリング対象の言語コード (e.g., typescript)                               |
| sort_by  | query | enum    | Yes  | ソート基準: `7d_increase`, `30d_increase`, `7d_rate`, `30d_rate`, `total_stars` |
| page     | query | integer | No   | ページ番号（デフォルト: 1）                                                     |
| limit    | query | integer | No   | 取得件数（デフォルト: 100）                                                     |

### レスポンス

**200 OK**

```json
[
  {
    "id": "a49ad09a-2117-46d6-91d9-6a6ce3975a96",
    "full_name": "owner/repo-name",
    "stargazers_count": 12000,
    "stars_7d_increase": 500,
    "stars_30d_rate": 0.15
  }
]
```

### 処理手順

1. リクエストされた言語、ソート基準、ページネーションパラメータを検証
2. DB（repositories, metrics_daily）から最新の日次メトリクスを結合して取得
3. ソート・フィルタリング・ページネーションを適用
4. クライアントに返却

---

## bac-002: リポジトリ詳細情報と90日間スター推移取得

特定のリポジトリIDに基づき、基本情報、トピックス、および過去90日間の日次スター数スナップショットデータを取得する。

- **メソッド**: GET
- **パス**: `/api/repositories/{repoId}`
- **ファイル名**: `repositories-[repoId].ts`
- **関連画面**: [scr-002](./画面一覧.md#scr-002-リポジトリ詳細画面)
- **関連機能**: fun-012, fun-048

### パラメータ

| 名前   | 位置 | 型   | 必須 | 説明           |
| ------ | ---- | ---- | ---- | -------------- |
| repoId | path | UUID | Yes  | リポジトリUUID |

### レスポンス

**200 OK**

```json
{
  "full_name": "owner/repo",
  "description": "A great repo",
  "topics": ["typescript", "react"],
  "history": [{ "date": "2026-01-01", "stargazers_count": 11500, "daily_increase": 50 }]
}
```

**404 Not Found**: リポジトリが見つかりません

---

## bac-003: リポジトリ名検索実行

検索クエリ文字列に基づき、リポジトリ名（フルネームまたは部分一致）を検索し、一覧を返却する。

- **メソッド**: GET
- **パス**: `/api/repositories/search`
- **ファイル名**: `repositories-search.ts`
- **関連画面**: [scr-001](./画面一覧.md#scr-001-トレンド一覧画面-日次), [scr-004](./画面一覧.md#scr-004-検索結果一覧画面)
- **関連機能**: fun-016

### パラメータ

| 名前  | 位置  | 型      | 必須 | 説明                             |
| ----- | ----- | ------- | ---- | -------------------------------- |
| query | query | string  | Yes  | 検索クエリ（リポジトリ名の一部） |
| limit | query | integer | No   | 最大返却件数（デフォルト: 50）   |

### レスポンス

**200 OK**

```json
[{ "id": "uuid", "full_name": "owner/repo", "description": "..." }]
```

---

## bac-004: 週別トレンドランキング取得

指定された年、週番号、言語に基づき、週別集計ランキングデータを取得する。

- **メソッド**: GET
- **パス**: `/api/trends/weekly`
- **ファイル名**: `trends-weekly.ts`
- **関連画面**: [scr-003](./画面一覧.md#scr-003-週別トレンドランキング画面)
- **関連機能**: fun-019, fun-020

### パラメータ

| 名前     | 位置  | 型             | 必須 | 説明         |
| -------- | ----- | -------------- | ---- | ------------ |
| year     | query | integer        | Yes  | ISO年        |
| week     | query | integer (1-53) | Yes  | ISO週番号    |
| language | query | string         | No   | 言語フィルタ |

### レスポンス

**200 OK**

```json
{
  "metadata": { "year": 2026, "week": 5, "language": "all" },
  "ranking": [{ "repo_id": "uuid", "increase": 500 }]
}
```

---

## bac-005: 閲覧可能な過去週リスト取得

データが存在する過去の週（年とISO週番号）の一覧を取得する。

- **メソッド**: GET
- **パス**: `/api/trends/weekly/available-weeks`
- **ファイル名**: `trends-weekly-available.ts`
- **関連画面**: [scr-003](./画面一覧.md#scr-003-週別トレンドランキング画面)
- **関連機能**: fun-021

### レスポンス

**200 OK**

```json
[
  { "year": 2026, "week": 5 },
  { "year": 2026, "week": 6 }
]
```

---

## bac-006: GitHub OAuth認証コールバック処理

GitHubからの認証コードを受け取り、トークン交換、ユーザー情報取得、DB登録/ログイン処理、セッション/JWT生成を行う。

- **メソッド**: GET
- **パス**: `/api/auth/callback/github`
- **ファイル名**: `auth-callback-github.ts`
- **関連画面**: [scr-011](./画面一覧.md#scr-011-ログイン画面ナビゲーション)
- **関連機能**: fun-031, fun-032

### パラメータ

| 名前 | 位置  | 型     | 必須 | 説明             |
| ---- | ----- | ------ | ---- | ---------------- |
| code | query | string | Yes  | GitHub認証コード |

### レスポンス

- **302 Found**: 認証成功。メイン画面へリダイレクト、JWTセッションをCookie設定
- **400 Bad Request**: 無効な認証コードまたはState

---

## bac-007: リポジトリAI要約取得（権限チェック込み）

指定されたリポジトリのAI要約データを取得する。ユーザーのログイン状態と課金プランに応じて、全文またはプレビューを出し分ける。

- **メソッド**: GET
- **パス**: `/api/repositories/{repoId}/summary`
- **ファイル名**: `repositories-[repoId]-summary.ts`
- **関連画面**: [scr-005](./画面一覧.md#scr-005-ai要約全文スライドビュー), [scr-006](./画面一覧.md#scr-006-ai要約プレビューアップグレード誘導画面)
- **関連機能**: fun-035, fun-037

### パラメータ

| 名前   | 位置 | 型   | 必須 | 説明           |
| ------ | ---- | ---- | ---- | -------------- |
| repoId | path | UUID | Yes  | リポジトリUUID |

### レスポンス

**200 OK**

```json
{
  "status": "FULL | PREVIEW | NOT_GENERATED",
  "summary_data": {}
}
```

- **401 Unauthorized**: 認証が必要

---

## bac-008: AI要約オンデマンド生成要求

課金ユーザーが未生成のリポジトリに対してAI要約の生成を要求する。

- **メソッド**: POST
- **パス**: `/api/repositories/{repoId}/summary/generate`
- **ファイル名**: `repositories-[repoId]-generate.ts`
- **認証**: Bearer JWT必須
- **関連画面**: [scr-007](./画面一覧.md#scr-007-ai要約オンデマンド生成要求画面)
- **関連機能**: fun-039, fun-040, fun-054

### レスポンス

- **202 Accepted**: 生成要求を受け付け、非同期処理を開始
- **403 Forbidden**: 課金プラン外またはクレジット/制限不足

---

## bac-009: Stripe Checkoutセッション生成

ユーザーが選択した課金プランに基づき、Stripe Checkoutセッションを生成し、決済用URLを返す。

- **メソッド**: POST
- **パス**: `/api/billing/checkout`
- **ファイル名**: `billing-checkout.ts`
- **認証**: Bearer JWT必須
- **関連画面**: [scr-008](./画面一覧.md#scr-008-課金プラン選択画面)
- **関連機能**: fun-049

### リクエストボディ

```json
{
  "plan_id": "stripe_price_id",
  "redirect_url": "https://example.com/success"
}
```

### レスポンス

**200 OK**

```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

---

## bac-010: Stripe Webhookによる決済イベント処理

Stripeからの決済成功/失敗イベントを受信し、ユーザーの課金プランやクレジット情報をDBに反映する。

- **メソッド**: POST
- **パス**: `/api/webhook/stripe`
- **ファイル名**: `webhook-stripe.ts`
- **関連画面**: [scr-009](./画面一覧.md#scr-009-決済結果画面)
- **関連機能**: fun-050, fun-051, fun-033

### レスポンス

- **200 OK**: イベント処理成功
- **400 Bad Request**: 無効な署名またはペイロード

---

## bac-011: 日次データ収集＆スナップショット保存

定期実行されるバッチ処理。追跡対象リポジトリの最新情報をGitHub APIから取得し、マスタ情報とスナップショットを保存する。

- **メソッド**: POST
- **パス**: `/api/internal/batch/collect-daily`
- **ファイル名**: `batch-collect-daily.ts`
- **認証**: 内部認証
- **関連機能**: fun-023, fun-024, fun-052

---

## bac-012: 7日間/30日間スター増加率計算

日次スナップショットデータに基づき、リポジトリごとの過去7日間および30日間のスター増加数/増加率を計算し、metrics_dailyテーブルに保存する。

- **メソッド**: POST
- **パス**: `/api/internal/batch/calculate-metrics`
- **ファイル名**: `batch-calculate-metrics.ts`
- **認証**: 内部認証
- **関連機能**: fun-027, fun-028

---

## bac-013: 週別トレンド集計とランキング保存

週の変わり目に実行され、過去7日間のスター増加数に基づき週別トレンドランキングを計算・保存する。

- **メソッド**: POST
- **パス**: `/api/internal/batch/calculate-weekly`
- **ファイル名**: `batch-calculate-weekly.ts`
- **認証**: 内部認証
- **関連機能**: fun-025, fun-026

---

## bac-014: 週別トップリポジトリAI要約自動生成

週別トレンドで注目されたリポジトリに対し、自動でAI要約を生成し、ai_summariesテーブルに保存する。

- **メソッド**: POST
- **パス**: `/api/internal/batch/generate-ai`
- **ファイル名**: `batch-generate-ai.ts`
- **認証**: 内部認証
- **関連機能**: fun-042, fun-043, fun-041
