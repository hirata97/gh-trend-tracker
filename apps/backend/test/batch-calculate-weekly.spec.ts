import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

const INTERNAL_TOKEN = 'test-internal-token';
const BASE_URL = 'http://example.com/api/internal/batch/calculate-weekly';

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
      `CREATE TABLE IF NOT EXISTS ranking_weekly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    language TEXT NOT NULL DEFAULT 'all',
    rank_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(year, week_number, language)
  )`
    )
    .run();

  // metrics_daily も他テストとの互換性のため作成
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
  await db.prepare('DELETE FROM ranking_weekly').run();
  await db.prepare('DELETE FROM repo_snapshots').run();
  await db.prepare('DELETE FROM repositories').run();
});

/** テスト用リポジトリを挿入 */
async function insertRepo(
  db: D1Database,
  repoId: number,
  name: string,
  language: string = 'TypeScript'
) {
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
       VALUES (?, ?, ?, 'test-owner', ?, 'Test repo', 'https://github.com/test/' || ?, '2025-01-01', '2025-01-01')`
    )
    .bind(repoId, name, `test-owner/${name}`, language, name)
    .run();
}

/** テスト用スナップショットを挿入 */
async function insertSnapshot(
  db: D1Database,
  repoId: number,
  snapshotDate: string,
  stars: number
) {
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date, created_at)
       VALUES (?, ?, 10, 5, 3, ?, datetime('now'))`
    )
    .bind(repoId, stars, snapshotDate)
    .run();
}

describe('POST /api/internal/batch/calculate-weekly', () => {
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
    it('リポジトリはあるが対象週のスナップショットがない場合は正常応答', async () => {
      const db = env.DB as D1Database;
      await insertRepo(db, 1, 'test-repo');

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        message: string;
        summary: { totalRankings: number; totalRepos: number };
      };
      expect(data.summary.totalRepos).toBe(0);
      expect(data.message).toContain('completed');
    });
  });

  describe('週別ランキング集計', () => {
    // テスト用に前の週の月曜〜日曜のスナップショットデータを用意する
    function getLastWeekDates(): { monday: string; sunday: string } {
      const now = new Date();
      const lastWeek = new Date(now);
      lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
      // 前の週の月曜日を計算
      const dayOfWeek = lastWeek.getUTCDay() || 7;
      const monday = new Date(lastWeek);
      monday.setUTCDate(lastWeek.getUTCDate() - dayOfWeek + 1);
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      return {
        monday: monday.toISOString().split('T')[0],
        sunday: sunday.toISOString().split('T')[0],
      };
    }

    it('全言語のランキングが生成されること', async () => {
      const db = env.DB as D1Database;
      const { monday, sunday } = getLastWeekDates();

      await insertRepo(db, 100, 'repo-a', 'TypeScript');
      await insertRepo(db, 101, 'repo-b', 'Python');
      await insertSnapshot(db, 100, monday, 1000);
      await insertSnapshot(db, 100, sunday, 1500);
      await insertSnapshot(db, 101, monday, 2000);
      await insertSnapshot(db, 101, sunday, 2300);

      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        summary: { totalRankings: number; totalRepos: number };
        year: number;
        weekNumber: number;
      };
      // all + TypeScript + Python = 3ランキング
      expect(data.summary.totalRankings).toBe(3);
      expect(data.summary.totalRepos).toBe(2);
      expect(data.year).toBeGreaterThan(0);
      expect(data.weekNumber).toBeGreaterThan(0);

      // ranking_weeklyテーブルにデータが保存されていること
      const rows = await db
        .prepare('SELECT * FROM ranking_weekly ORDER BY language')
        .all();
      expect(rows.results.length).toBe(3);

      // 全言語ランキングを検証
      const allRanking = rows.results.find((r: Record<string, unknown>) => r.language === 'all');
      expect(allRanking).toBeDefined();
      const allRankData = JSON.parse(allRanking!.rank_data as string) as Array<{
        rank: number;
        repo_id: number;
        star_increase: number;
      }>;
      // repo-a: +500, repo-b: +300 → repo-aが1位
      expect(allRankData[0].repo_id).toBe(100);
      expect(allRankData[0].star_increase).toBe(500);
      expect(allRankData[0].rank).toBe(1);
      expect(allRankData[1].repo_id).toBe(101);
      expect(allRankData[1].star_increase).toBe(300);
    });

    it('言語別ランキングが正しく分離されること', async () => {
      const db = env.DB as D1Database;
      const { monday, sunday } = getLastWeekDates();

      await insertRepo(db, 200, 'ts-repo', 'TypeScript');
      await insertRepo(db, 201, 'py-repo', 'Python');
      await insertSnapshot(db, 200, monday, 100);
      await insertSnapshot(db, 200, sunday, 300);
      await insertSnapshot(db, 201, monday, 500);
      await insertSnapshot(db, 201, sunday, 600);

      await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });

      // TypeScriptランキング
      const tsRanking = await db
        .prepare('SELECT rank_data FROM ranking_weekly WHERE language = ?')
        .bind('TypeScript')
        .first();
      expect(tsRanking).not.toBeNull();
      const tsData = JSON.parse(tsRanking!.rank_data as string) as Array<{
        repo_id: number;
        star_increase: number;
      }>;
      expect(tsData.length).toBe(1);
      expect(tsData[0].repo_id).toBe(200);
      expect(tsData[0].star_increase).toBe(200);

      // Pythonランキング
      const pyRanking = await db
        .prepare('SELECT rank_data FROM ranking_weekly WHERE language = ?')
        .bind('Python')
        .first();
      expect(pyRanking).not.toBeNull();
      const pyData = JSON.parse(pyRanking!.rank_data as string) as Array<{
        repo_id: number;
      }>;
      expect(pyData.length).toBe(1);
      expect(pyData[0].repo_id).toBe(201);
    });

    it('トップ10までに制限されること', async () => {
      const db = env.DB as D1Database;
      const { monday, sunday } = getLastWeekDates();

      // 12個のリポジトリを追加
      for (let i = 0; i < 12; i++) {
        await insertRepo(db, 300 + i, `repo-${i}`, 'TypeScript');
        await insertSnapshot(db, 300 + i, monday, 100);
        await insertSnapshot(db, 300 + i, sunday, 100 + (i + 1) * 10);
      }

      await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });

      const tsRanking = await db
        .prepare('SELECT rank_data FROM ranking_weekly WHERE language = ?')
        .bind('TypeScript')
        .first();
      const tsData = JSON.parse(tsRanking!.rank_data as string) as Array<{
        rank: number;
      }>;
      expect(tsData.length).toBe(10);
      // rank 1は最もスター増加が多いもの
      expect(tsData[0].rank).toBe(1);
      expect(tsData[9].rank).toBe(10);
    });

    it('再実行時にデータが上書きされること（冪等性）', async () => {
      const db = env.DB as D1Database;
      const { monday, sunday } = getLastWeekDates();

      await insertRepo(db, 400, 'idempotent-repo', 'TypeScript');
      await insertSnapshot(db, 400, monday, 100);
      await insertSnapshot(db, 400, sunday, 200);

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

      // ranking_weeklyが重複せず正しい件数であること
      const rows = await db
        .prepare('SELECT COUNT(*) as cnt FROM ranking_weekly WHERE language = ?')
        .bind('all')
        .first();
      expect(rows!.cnt).toBe(1);
    });

    it('レスポンスにyear, weekNumberが含まれること', async () => {
      const response = await SELF.fetch(BASE_URL, {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        year: number;
        weekNumber: number;
        durationMs: number;
      };
      expect(typeof data.year).toBe('number');
      expect(typeof data.weekNumber).toBe('number');
      expect(typeof data.durationMs).toBe('number');
    });
  });
});
