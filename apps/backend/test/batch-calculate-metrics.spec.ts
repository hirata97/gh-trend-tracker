import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const INTERNAL_TOKEN = 'test-internal-token';
const BASE_URL = 'http://example.com/api/internal/batch/calculate-metrics';

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
    FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE,
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
    PRIMARY KEY (repo_id, calculated_date),
    FOREIGN KEY (repo_id) REFERENCES repositories(repo_id) ON DELETE CASCADE
  )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS languages (
    code TEXT PRIMARY KEY NOT NULL,
    name_ja TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100
  )`
    )
    .run();
});

beforeEach(async () => {
  const db = env.DB as D1Database;
  // テストごとにデータをクリア
  await db.prepare('DELETE FROM metrics_daily').run();
  await db.prepare('DELETE FROM repo_snapshots').run();
  await db.prepare('DELETE FROM repositories').run();
});

/** 今日のISO日付を取得 */
function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** N日前のISO日付を取得 */
function getDaysAgoISO(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split('T')[0];
}

/** テスト用リポジトリを挿入 */
async function insertRepo(db: D1Database, repoId: number, name: string) {
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
       VALUES (?, ?, ?, 'test-owner', 'TypeScript', 'Test repo', 'https://github.com/test/' || ?, '2025-01-01', '2025-01-01')`
    )
    .bind(repoId, name, `test-owner/${name}`, name)
    .run();
}

/** テスト用スナップショットを挿入 */
async function insertSnapshot(db: D1Database, repoId: number, snapshotDate: string, stars: number) {
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date, created_at)
       VALUES (?, ?, 10, 5, 3, ?, datetime('now'))`
    )
    .bind(repoId, stars, snapshotDate)
    .run();
}

describe('POST /api/internal/batch/calculate-metrics', () => {
  describe('認証', () => {
    it('X-Internal-Tokenヘッダーがない場合は401が返されること', async () => {
      const response = await SELF.fetch(BASE_URL, { method: 'POST' });
      expect(response.status).toBe(401);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('不正なトークンの場合は401が返されること', async () => {
      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': 'wrong-token' },
      });
      expect(response.status).toBe(401);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('正しいトークンの場合は401以外が返されること', async () => {
      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).not.toBe(401);
    });
  });

  describe('GETメソッド', () => {
    it('GETリクエストの場合は404が返されること', async () => {
      const response = await SELF.fetch(BASE_URL, {
        method: 'GET',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(404);
    });
  });

  describe('スナップショットなし', () => {
    it('リポジトリはあるが本日のスナップショットがない場合はtotal=0で正常応答', async () => {
      const db = env.DB as D1Database;
      await insertRepo(db, 1, 'test-repo');

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        message: string;
        summary: { total: number; success: number; skipped: number; errors: number };
      };
      expect(data.summary.total).toBe(0);
      expect(data.message).toContain('No repositories');
    });
  });

  describe('メトリクス計算', () => {
    it('7日前・30日前の両方のデータがある場合、正しく増加数・増加率が計算されること', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 100, 'popular-repo');
      await insertSnapshot(db, 100, getDaysAgoISO(30), 1000); // 30日前: 1000スター
      await insertSnapshot(db, 100, getDaysAgoISO(7), 1200); // 7日前: 1200スター
      await insertSnapshot(db, 100, today, 1500); // 今日: 1500スター

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        summary: { total: number; success: number; errors: number };
        calculatedDate: string;
      };
      expect(data.summary.total).toBe(1);
      expect(data.summary.success).toBe(1);
      expect(data.summary.errors).toBe(0);
      expect(data.calculatedDate).toBe(today);

      // metrics_dailyテーブルの値を直接検証
      const metrics = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ? AND calculated_date = ?')
        .bind(100, today)
        .first();

      expect(metrics).not.toBeNull();
      // 7日間: 1500 - 1200 = 300
      expect(metrics!.stars_7d_increase).toBe(300);
      // 7日間増加率: 300 / 1200 = 0.25
      expect(metrics!.stars_7d_rate).toBe(0.25);
      // 30日間: 1500 - 1000 = 500
      expect(metrics!.stars_30d_increase).toBe(500);
      // 30日間増加率: 500 / 1000 = 0.5
      expect(metrics!.stars_30d_rate).toBe(0.5);
    });

    it('7日前のデータがない場合、7日間増加数=0・増加率=0になること', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 200, 'new-repo');
      await insertSnapshot(db, 200, getDaysAgoISO(30), 500);
      await insertSnapshot(db, 200, today, 800);
      // 7日前のデータなし

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const metrics = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ? AND calculated_date = ?')
        .bind(200, today)
        .first();

      expect(metrics).not.toBeNull();
      expect(metrics!.stars_7d_increase).toBe(0);
      expect(metrics!.stars_7d_rate).toBe(0);
      expect(metrics!.stars_30d_increase).toBe(300);
      expect(metrics!.stars_30d_rate).toBe(0.6);
    });

    it('30日前のデータがない場合、30日間増加数=0・増加率=0になること', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 300, 'week-old-repo');
      await insertSnapshot(db, 300, getDaysAgoISO(7), 100);
      await insertSnapshot(db, 300, today, 150);
      // 30日前のデータなし

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const metrics = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ? AND calculated_date = ?')
        .bind(300, today)
        .first();

      expect(metrics).not.toBeNull();
      expect(metrics!.stars_7d_increase).toBe(50);
      expect(metrics!.stars_7d_rate).toBe(0.5);
      expect(metrics!.stars_30d_increase).toBe(0);
      expect(metrics!.stars_30d_rate).toBe(0);
    });

    it('スター数が0の場合、増加率=0になること（ゼロ除算回避）', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 400, 'zero-stars-repo');
      await insertSnapshot(db, 400, getDaysAgoISO(7), 0); // 7日前: 0スター
      await insertSnapshot(db, 400, today, 5); // 今日: 5スター

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const metrics = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ? AND calculated_date = ?')
        .bind(400, today)
        .first();

      expect(metrics).not.toBeNull();
      expect(metrics!.stars_7d_increase).toBe(5);
      // 分母が0なので増加率=0
      expect(metrics!.stars_7d_rate).toBe(0);
    });

    it('スター数が減少した場合、マイナス値が許容されること', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 500, 'declining-repo');
      await insertSnapshot(db, 500, getDaysAgoISO(7), 1000);
      await insertSnapshot(db, 500, today, 950);

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const metrics = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ? AND calculated_date = ?')
        .bind(500, today)
        .first();

      expect(metrics).not.toBeNull();
      expect(metrics!.stars_7d_increase).toBe(-50);
      expect(metrics!.stars_7d_rate).toBe(-0.05);
    });

    it('複数リポジトリが正しく処理されること', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 600, 'repo-a');
      await insertRepo(db, 601, 'repo-b');
      await insertSnapshot(db, 600, getDaysAgoISO(7), 100);
      await insertSnapshot(db, 600, today, 200);
      await insertSnapshot(db, 601, getDaysAgoISO(7), 500);
      await insertSnapshot(db, 601, today, 600);

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        summary: { total: number; success: number };
      };
      expect(data.summary.total).toBe(2);
      expect(data.summary.success).toBe(2);

      // 両方のメトリクスが保存されていることを確認
      const metricsA = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ?')
        .bind(600)
        .first();
      const metricsB = await db
        .prepare('SELECT * FROM metrics_daily WHERE repo_id = ?')
        .bind(601)
        .first();
      expect(metricsA).not.toBeNull();
      expect(metricsB).not.toBeNull();
      expect(metricsA!.stars_7d_increase).toBe(100);
      expect(metricsB!.stars_7d_increase).toBe(100);
    });

    it('再実行時にメトリクスが上書きされること（冪等性）', async () => {
      const db = env.DB as D1Database;
      const today = getTodayISO();

      await insertRepo(db, 700, 'idempotent-repo');
      await insertSnapshot(db, 700, getDaysAgoISO(7), 100);
      await insertSnapshot(db, 700, today, 200);

      // 1回目実行
      await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });

      // 2回目実行
      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      // メトリクスが重複せず1件であること
      const rows = await db
        .prepare('SELECT COUNT(*) as cnt FROM metrics_daily WHERE repo_id = ?')
        .bind(700)
        .first();
      expect(rows!.cnt).toBe(1);
    });
  });
});
