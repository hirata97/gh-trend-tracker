# ER図

データベースのエンティティ関連図。

```mermaid
erDiagram
    languages {
        TEXT code PK "言語コード (ts, py, all)"
        TEXT name_ja "日本語名"
        INT sort_order "表示順序"
    }

    users {
        UUID id PK "ユーザーID"
        BIGINT github_id UK "GitHub ID"
        TEXT username "ユーザー名"
        TEXT plan "課金プラン (FREE/PRO/ENTERPRISE)"
        INT credits_remaining "残クレジット"
        TEXT stripe_customer_id UK "Stripe顧客ID"
    }

    repositories {
        UUID id PK "リポジトリID"
        BIGINT github_id UK "GitHub ID"
        TEXT full_name UK "フルネーム (owner/repo)"
        TEXT description "概要"
        TEXT language FK "主要言語"
        INT stargazers_count "スター数"
        INT forks_count "フォーク数"
        JSON topics "トピックス"
        TIMESTAMP last_synced_at "最終同期日時"
    }

    repo_snapshots {
        BIGINT id PK "スナップショットID"
        UUID repo_id FK "リポジトリID"
        DATE snapshot_date "スナップショット日付"
        INT stargazers_count "スター数"
        INT daily_increase "日次増加数"
    }

    metrics_daily {
        UUID repo_id PK_FK "リポジトリID"
        DATE calculated_date PK "計算日付"
        INT stars_7d_increase "7日間増加数"
        INT stars_30d_increase "30日間増加数"
        REAL stars_7d_rate "7日間増加率"
        REAL stars_30d_rate "30日間増加率"
    }

    ranking_weekly {
        UUID id PK "ランキングID"
        INT year "年"
        INT week_number "ISO週番号"
        TEXT language FK "言語"
        JSON rank_data "ランキングデータ"
    }

    ai_summaries {
        UUID repo_id PK_FK "リポジトリID"
        TEXT language PK "要約言語 (ja/en)"
        TIMESTAMP generated_at "生成日時"
        JSON summary_data "要約データ"
    }

    %% リレーションシップ
    languages ||--o{ repositories : "categorizes"
    languages ||--o{ ranking_weekly : "filters"

    repositories ||--o{ repo_snapshots : "has"
    repositories ||--o{ metrics_daily : "has"
    repositories ||--o{ ai_summaries : "has"
```

## テーブル関連

### 1対多の関係

| 親テーブル | 子テーブル | 関係 |
|-----------|-----------|------|
| languages | repositories | 1つの言語に複数のリポジトリ |
| languages | ranking_weekly | 1つの言語に複数の週別ランキング |
| repositories | repo_snapshots | 1つのリポジトリに複数のスナップショット |
| repositories | metrics_daily | 1つのリポジトリに複数の日次メトリクス |
| repositories | ai_summaries | 1つのリポジトリに複数の言語別要約 |

### 独立テーブル

| テーブル | 説明 |
|---------|------|
| users | 他テーブルとの直接的なFK関係なし（将来的にお気に入り機能等で関連付け予定） |

## インデックス設計

### repositories

- `github_id` (UNIQUE)
- `full_name` (UNIQUE)
- `language` (検索・フィルタリング用)

### repo_snapshots

- `(repo_id, snapshot_date)` (UNIQUE)
- `snapshot_date` (日付範囲検索用)

### metrics_daily

- `(repo_id, calculated_date)` (複合主キー)

### ranking_weekly

- `(year, week_number, language)` (UNIQUE)
