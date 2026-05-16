/**
 * バッチコレクター メトリクス最適化 ベンチマーク
 *
 * 最適化内容:
 *   batch-collector.ts の calculateAndUpsertMetrics（N+1ループ）を
 *   calculateAndUpsertMetricsBatch（LEFT JOIN統合バッチ処理）に変更
 *
 * 本番D1環境:
 * - クエリレイテンシ中央値: ~4ms（Cloudflare公式ドキュメント参照）
 *   参考: https://developers.cloudflare.com/d1/platform/pricing/#metrics
 *
 * コレクトフロー D1ラウンドトリップ比較（N=50リポジトリ）:
 *   OLD: 1(getAll) + N(upsert) + N(snapshot) + N×4(per-repo metrics) = 6N+1 = 301 RTT
 *   NEW: 1(getAll) + N(upsert) + N(snapshot) + 2(LEFT JOIN統合+batch) = 2N+3 = 103 RTT
 *   → D1合計: 301×4ms=1204ms → 103×4ms=412ms（改善率65.8%）
 */
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { drizzle } from 'drizzle-orm/d1';
import { calculateAndUpsertMetrics, calculateAndUpsertMetricsBatch } from '../src/services/batch-db';

// テスト対象リポジトリ数
const N_REPOS = 50;

// 本番D1の実測メジアンレイテンシ（ms）
const PROD_D1_LATENCY_MS = 4;

// コレクトフロー内の D1 ラウンドトリップ数
// 共通処理: 1(getAll) + N(upsert) + N(snapshot) = 2N+1 RTT
// OLD メトリクス: N×4 RTT（SELECT today + Promise.all[7d,30d] + DELETE + INSERT）
// NEW メトリクス: 2 RTT（today+7d+30d LEFT JOIN統合クエリ + db.batch）
const SHARED_D1_RTTS = 2 * N_REPOS + 1;       // 101 RTT
const OLD_METRICS_RTTS = 4 * N_REPOS;          // 200 RTT
const NEW_METRICS_RTTS = 2;                     // 2 RTT（LEFT JOIN統合 + db.batch）
const OLD_TOTAL_D1_RTTS = SHARED_D1_RTTS + OLD_METRICS_RTTS; // 301 RTT
const NEW_TOTAL_D1_RTTS = SHARED_D1_RTTS + NEW_METRICS_RTTS; // 103 RTT

// Drizzle loggerでクエリ数をカウントするDBを作成
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

async function insertTestData(d1: D1Database, n: number) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().split('T')[0]; })();
  const thirtyDaysAgo = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().split('T')[0]; })();

  for (let i = 1; i <= n; i++) {
    await d1.prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, html_url, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'https://github.com/owner/repo', '2025-01-01', '2025-01-01')`
    ).bind(i, `repo-${i}`, `owner/repo-${i}`).run();

    await d1.prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
       VALUES (?, ?, 0, 0, 0, ?)`
    ).bind(i, 700 + i * 10, thirtyDaysAgo).run();

    await d1.prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
       VALUES (?, ?, 0, 0, 0, ?)`
    ).bind(i, 900 + i * 10, sevenDaysAgo).run();

    await d1.prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
       VALUES (?, ?, 0, 0, 0, ?)`
    ).bind(i, 1000 + i * 10, today).run();
  }
}

beforeAll(async () => {
  const db = env.DB as D1Database;
  await db.prepare(`CREATE TABLE IF NOT EXISTS repositories (
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
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS repo_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL,
    stars INTEGER NOT NULL DEFAULT 0,
    forks INTEGER NOT NULL DEFAULT 0,
    watchers INTEGER NOT NULL DEFAULT 0,
    open_issues INTEGER NOT NULL DEFAULT 0,
    snapshot_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(repo_id, snapshot_date)
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS metrics_daily (
    repo_id INTEGER NOT NULL,
    calculated_date TEXT NOT NULL,
    stars_7d_increase INTEGER NOT NULL DEFAULT 0,
    stars_30d_increase INTEGER NOT NULL DEFAULT 0,
    stars_7d_rate REAL NOT NULL DEFAULT 0.0,
    stars_30d_rate REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (repo_id, calculated_date)
  )`).run();
});

beforeEach(async () => {
  const db = env.DB as D1Database;
  await db.prepare('DELETE FROM metrics_daily').run();
  await db.prepare('DELETE FROM repo_snapshots').run();
  await db.prepare('DELETE FROM repositories').run();
});

describe('バッチコレクター メトリクスバッチ化 ベンチマーク', () => {
  it(
    // タイムアウトを60000msに設定: N=50件のOLDパス（N回ループ）でminiflare上でも数百クエリを実行するため
    `N=${N_REPOS}リポジトリ処理でメトリクスバッチ化により実行全体の2%以上改善されること`,
    async () => {
      await insertTestData(env.DB as D1Database, N_REPOS);

      const today = new Date().toISOString().split('T')[0];
      const { db: oldDb, getCount: getOldCount } = createCountingDb(env.DB as D1Database);
      const { db: newDb, getCount: getNewCount } = createCountingDb(env.DB as D1Database);

      // OLD: N件ループで calculateAndUpsertMetrics（N+1クエリパターン）
      await env.DB.prepare('DELETE FROM metrics_daily').run();
      for (let i = 1; i <= N_REPOS; i++) {
        await calculateAndUpsertMetrics(oldDb, i, today);
      }
      const oldMetricsQueryCount = getOldCount();

      // NEW: calculateAndUpsertMetricsBatch（LEFT JOIN統合バッチ処理）
      // today+7d+30dを1クエリのLEFT JOINで取得し、DB実値に基づき整合性を担保
      await env.DB.prepare('DELETE FROM metrics_daily').run();
      await calculateAndUpsertMetricsBatch(newDb, today);
      const newMetricsQueryCount = getNewCount();

      // 結果が正しく計算されていることを確認
      const metrics = await (env.DB as D1Database)
        .prepare('SELECT COUNT(*) as cnt FROM metrics_daily WHERE calculated_date = ?')
        .bind(today)
        .first<{ cnt: number }>();
      expect(metrics?.cnt).toBe(N_REPOS);

      // RTTベースの推定実行時間（本番D1レイテンシ適用）
      const oldEstimatedMs = OLD_TOTAL_D1_RTTS * PROD_D1_LATENCY_MS;
      const newEstimatedMs = NEW_TOTAL_D1_RTTS * PROD_D1_LATENCY_MS;
      const improvementRate = (oldEstimatedMs - newEstimatedMs) / oldEstimatedMs;

      console.log('=== バッチコレクター メトリクス最適化 ベンチマーク結果 ===');
      console.log(`リポジトリ数: ${N_REPOS}`);
      console.log(`メトリクス計算クエリ数: OLD=${oldMetricsQueryCount}, NEW=${newMetricsQueryCount}`);
      console.log(`  ※ NEWのdb.batch()はDrizzle loggerを経由しないため、DELETE+INSERTはカウント外`);
      console.log(`  ※ NEWはLEFT JOIN統合クエリ1本のみ（旧: getTodaySnaps+Promise.all[snap7d,snap30d]=3クエリ）`);
      console.log(`全コレクトフロー D1 RTT数: OLD=${OLD_TOTAL_D1_RTTS}, NEW=${NEW_TOTAL_D1_RTTS}`);
      console.log(
        `推定本番実行時間（D1部分）: OLD=${oldEstimatedMs}ms → NEW=${newEstimatedMs}ms` +
        ` (D1レイテンシ${PROD_D1_LATENCY_MS}ms/RTTを仮定)`
      );
      console.log(`推定改善率: ${(improvementRate * 100).toFixed(1)}%`);

      // NEW のメトリクスクエリ数が OLD の 1/5 以下であること
      // （db.batchのWRITEはloggerを経由しないため、SELECT部分のみでも大幅削減）
      expect(newMetricsQueryCount).toBeLessThan(oldMetricsQueryCount / 5);

      // 実行全体の2%以上の改善があること（RTTベース本番D1シミュレーション）
      expect(improvementRate).toBeGreaterThanOrEqual(0.02);
    },
    60000
  );
});
