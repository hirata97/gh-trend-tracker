import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { RepoDetailResponse, HistoryResponse, ApiError } from '@gh-trend-tracker/shared';

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
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, homepage, topics, created_at, updated_at)
    VALUES (10, 'typescript', 'microsoft/typescript', 'microsoft', 'TypeScript', 'TypeScript compiler', 'https://github.com/microsoft/typescript', 'https://typescriptlang.org', '["compiler","language"]', '2024-01-01', '2024-06-01')`
    )
    .run();

  // weeklyGrowthRate計算には7件のスナップショットが必要（snapshots[6]が7日前）
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 100000, 12000, 3000, 500, '2026-02-09')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 99800, 11980, 2995, 498, '2026-02-08')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 99600, 11960, 2990, 496, '2026-02-07')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 99400, 11940, 2985, 494, '2026-02-06')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 99200, 11920, 2982, 492, '2026-02-05')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 99100, 11910, 2981, 491, '2026-02-04')`
    )
    .run();
  // 7件目（snapshots[6]）= 7日前のスナップショット
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (10, 99000, 11900, 2980, 490, '2026-02-03')`
    )
    .run();
});

describe('/api/repositories/:repoId', () => {
  describe('バリデーション', () => {
    it('repoIdに文字列を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/abc');
      expect(response.status).toBe(400);

      const data = (await response.json()) as ApiError;
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('repoIdに0を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/0');
      expect(response.status).toBe(400);
    });

    it('repoIdに負の整数を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/-1');
      expect(response.status).toBe(400);
    });
  });

  describe('正常レスポンス', () => {
    it('存在するrepoIdを指定したらrepository・currentStats・weeklyGrowthを含む200レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;

      expect(data).toHaveProperty('repository');
      expect(data).toHaveProperty('currentStats');
      expect(data).toHaveProperty('weeklyGrowth');
      expect(data).toHaveProperty('weeklyGrowthRate');
    });

    it('repositoryオブジェクトに必須フィールドが含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      const repo = data.repository;

      expect(repo).toHaveProperty('repoId', 10);
      expect(repo).toHaveProperty('name', 'typescript');
      expect(repo).toHaveProperty('fullName', 'microsoft/typescript');
      expect(repo).toHaveProperty('owner', 'microsoft');
      expect(repo).toHaveProperty('language', 'TypeScript');
      expect(repo).toHaveProperty('description', 'TypeScript compiler');
      expect(repo).toHaveProperty('htmlUrl');
      expect(repo).toHaveProperty('homepage');
      expect(Array.isArray(repo.topics)).toBe(true);
    });

    it('topicsがJSON文字列からパースされた配列として返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      expect(data.repository.topics).toEqual(['compiler', 'language']);
    });

    it('currentStatsにスナップショット情報が含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      const stats = data.currentStats;

      expect(stats).not.toBeNull();
      expect(stats).toHaveProperty('stars', 100000);
      expect(stats).toHaveProperty('forks', 12000);
      expect(stats).toHaveProperty('watchers', 3000);
      expect(stats).toHaveProperty('openIssues', 500);
      expect(stats).toHaveProperty('snapshotDate', '2026-02-09');
    });

    it('weeklyGrowthとweeklyGrowthRateが正しく計算されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      // 100000 - 99000 = 1000
      expect(data.weeklyGrowth).toBe(1000);
      // (1000 / 99000) * 100 ≒ 1.01%
      expect(data.weeklyGrowthRate).toBeCloseTo(1.01, 0);
    });
  });

  describe('404', () => {
    it('存在しないrepoIdを指定したら404エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/99999');
      expect(response.status).toBe(404);

      const data = (await response.json()) as ApiError;
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'NOT_FOUND');
    });
  });
});

describe('/api/repositories/:repoId/history', () => {
  describe('バリデーション', () => {
    it('repoIdに文字列を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/abc/history');
      expect(response.status).toBe(400);
    });
  });

  describe('正常レスポンス', () => {
    it('存在するrepoIdを指定したらhistory配列を含む200レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10/history');
      expect(response.status).toBe(200);

      const data = (await response.json()) as HistoryResponse;

      expect(data).toHaveProperty('history');
      expect(Array.isArray(data.history)).toBe(true);
      expect(data.history.length).toBeGreaterThan(0);
    });

    it('historyの各アイテムに必須フィールドが含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10/history');
      expect(response.status).toBe(200);

      const data = (await response.json()) as HistoryResponse;
      const item = data.history[0];

      expect(item).toHaveProperty('repoId', 10);
      expect(item).toHaveProperty('stars');
      expect(item).toHaveProperty('forks');
      expect(item).toHaveProperty('watchers');
      expect(item).toHaveProperty('openIssues');
      expect(item).toHaveProperty('snapshotDate');
    });

    it('historyが日付の降順で返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/10/history');
      expect(response.status).toBe(200);

      const data = (await response.json()) as HistoryResponse;
      expect(data.history[0].snapshotDate).toBe('2026-02-09');
      expect(data.history[1].snapshotDate).toBe('2026-02-08');
    });
  });

  describe('404', () => {
    it('存在しないrepoIdを指定したら404エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/99999/history');
      expect(response.status).toBe(404);

      const data = (await response.json()) as ApiError;
      expect(data).toHaveProperty('code', 'NOT_FOUND');
    });
  });
});
