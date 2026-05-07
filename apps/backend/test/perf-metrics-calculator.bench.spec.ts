/**
 * メトリクス計算バッチ処理のパフォーマンスベンチマーク
 *
 * 本番D1環境と比較:
 * - ローカルD1（Miniflare）のクエリレイテンシは ~0.1ms 程度
 * - 本番Cloudflare D1のクエリレイテンシは ~4ms（中央値）
 *   参考: https://developers.cloudflare.com/d1/platform/pricing/#metrics
 *
 * クエリ数を実測しシミュレーション時間で改善率を計算する
 */
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { runMetricsCalculation } from '../src/services/metrics-calculator';

// 本番D1の実測メジアンレイテンシ（ms）
const PROD_D1_LATENCY_MS = 4;

// テスト対象リポジトリ数
const N_REPOS = 100;

// 最適化前のクエリ数（N=100時）: 1（初期SELECT）+ N×5（per-repo処理）
const OLD_QUERY_COUNT = 1 + 5 * N_REPOS; // 501

// 最適化後の期待クエリ数（N=100時）:
//   1（初期SELECT+stars）+ 1（7d JOIN）+ 1（30d JOIN）+ 1（DELETE）+ ceil(100/16)=7（INSERT chunks）= 11
const NEW_EXPECTED_QUERY_COUNT = 11;

/**
 * Drizzle loggerでクエリ数をカウントするDBを作成する
 */
function createCountingDb(d1: D1Database) {
  let queryCount = 0;
  const db = drizzle(d1, {
    logger: {
      logQuery(_sql: string, _params: unknown[]) {
        queryCount++;
      },
    },
  });
  return {
    db,
    getCount: () => queryCount,
    reset: () => {
      queryCount = 0;
    },
  };
}

beforeAll(async () => {
  const db = env.DB as D1Database;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT UNIQUE NOT NULL,
    owner TEXT NOT NULL,
    language TEXT,
    description TEXT,
    html_url TEXT NOT NULL,
    homepage TEXT,
    topics TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    pushed_at TEXT
  )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS repo_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL,
    stars INTEGER NOT NULL DEFAULT 0,
    forks INTEGER NOT NULL DEFAULT 0,
    watchers INTEGER NOT NULL DEFAULT 0,
    open_issues INTEGER NOT NULL DEFAULT 0,
    snapshot_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(repo_id, snapshot_date)
  )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS metrics_daily (
    repo_id INTEGER NOT NULL,
    calculated_date TEXT NOT NULL,
    stars_7d_increase INTEGER NOT NULL DEFAULT 0,
    stars_30d_increase INTEGER NOT NULL DEFAULT 0,
    stars_7d_rate REAL NOT NULL DEFAULT 0.0,
    stars_30d_rate REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (repo_id, calculated_date)
  )`
    )
    .run();
});

beforeEach(async () => {
  const db = env.DB as D1Database;
  await db.prepare('DELETE FROM metrics_daily').run();
  await db.prepare('DELETE FROM repo_snapshots').run();
  await db.prepare('DELETE FROM repositories').run();
});

/** N日前のISO日付を取得 */
function getDaysAgoISO(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

/** N件のリポジトリと各スナップショット（今日・7日前・30日前）を挿入 */
async function insertTestData(d1: D1Database, n: number) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = getDaysAgoISO(7);
  const thirtyDaysAgo = getDaysAgoISO(30);

  for (let i = 1; i <= n; i++) {
    await d1
      .prepare(
        `INSERT INTO repositories (repo_id, name, full_name, owner, html_url, created_at, updated_at)
         VALUES (?, ?, ?, 'owner', 'https://github.com/owner/repo', '2025-01-01', '2025-01-01')`
      )
      .bind(i, `repo-${i}`, `owner/repo-${i}`)
      .run();

    // 30日前スナップショット
    await d1
      .prepare(
        `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
         VALUES (?, ?, 0, 0, 0, ?)`
      )
      .bind(i, 1000 + i * 10, thirtyDaysAgo)
      .run();

    // 7日前スナップショット
    await d1
      .prepare(
        `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
         VALUES (?, ?, 0, 0, 0, ?)`
      )
      .bind(i, 1200 + i * 10, sevenDaysAgo)
      .run();

    // 今日スナップショット
    await d1
      .prepare(
        `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
         VALUES (?, ?, 0, 0, 0, ?)`
      )
      .bind(i, 1500 + i * 10, today)
      .run();
  }
}

describe('メトリクス計算バッチ処理 クエリ数ベンチマーク', () => {
  it(
    `N=${N_REPOS}リポジトリ処理でクエリ数が削減され実行全体の2%以上改善されること`,
    async () => {
      await insertTestData(env.DB as D1Database, N_REPOS);

      const { db, getCount } = createCountingDb(env.DB as D1Database);

      const startTime = Date.now();
      const result = await runMetricsCalculation({ db });
      const actualElapsedMs = Date.now() - startTime;

      const actualQueryCount = getCount();

      // 推定本番実行時間
      const oldEstimatedMs = OLD_QUERY_COUNT * PROD_D1_LATENCY_MS;
      const newEstimatedMs = actualQueryCount * PROD_D1_LATENCY_MS;
      const improvementRate = (oldEstimatedMs - newEstimatedMs) / oldEstimatedMs;

      console.log('=== メトリクス計算バッチ最適化 ベンチマーク結果 ===');
      console.log(`リポジトリ数: ${N_REPOS}`);
      console.log(
        `クエリ数: ${actualQueryCount} (最適化前: ${OLD_QUERY_COUNT}, 期待値: ${NEW_EXPECTED_QUERY_COUNT})`
      );
      console.log(`ローカル実行時間: ${actualElapsedMs}ms`);
      console.log(
        `推定本番実行時間: ${newEstimatedMs}ms (最適化前: ${oldEstimatedMs}ms, D1レイテンシ${PROD_D1_LATENCY_MS}ms/クエリを仮定)`
      );
      console.log(`推定改善率: ${(improvementRate * 100).toFixed(1)}%`);
      console.log(`処理結果: total=${result.summary.total}, success=${result.summary.success}`);

      // クエリ数が期待値以下であること（並列クエリの実装差異で±1の誤差を許容）
      expect(actualQueryCount).toBeLessThanOrEqual(NEW_EXPECTED_QUERY_COUNT + 1);

      // 全リポジトリが正常処理されること
      expect(result.summary.total).toBe(N_REPOS);
      expect(result.summary.success).toBe(N_REPOS);
      expect(result.summary.errors).toBe(0);

      // 改善率が2%以上であること（D1レイテンシ4ms/クエリのシミュレーション値）
      expect(improvementRate).toBeGreaterThanOrEqual(0.02);
    },
    30000
  );
});
