import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { RepoDetailResponse, HistoryResponse } from '@gh-trend-tracker/shared';

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
    VALUES (1, 'react', 'facebook/react', 'facebook', 'JavaScript', 'A declarative UI library', 'https://github.com/facebook/react', 'https://react.dev', '["ui","javascript"]', '2024-01-01', '2024-06-01')`
    )
    .run();

  // 最新スナップショット（7件分）を登録して週間成長率の計算に対応
  for (let i = 0; i < 7; i++) {
    const date = new Date('2026-02-09');
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const stars = 230000 - i * 100;
    await db
      .prepare(
        `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date)
      VALUES (1, ?, 47000, 6700, 900, ?)`
      )
      .bind(stars, dateStr)
      .run();
  }
});

describe('/api/repositories/:repoId', () => {
  describe('正常レスポンス', () => {
    it('repository・currentStats・weeklyGrowth を含む 200 レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      expect(data).toHaveProperty('repository');
      expect(data).toHaveProperty('currentStats');
      expect(data).toHaveProperty('weeklyGrowth');
      expect(data).toHaveProperty('weeklyGrowthRate');
    });

    it('repository フィールドに必須プロパティが含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      const repo = data.repository;
      expect(repo).toHaveProperty('repoId', 1);
      expect(repo).toHaveProperty('name', 'react');
      expect(repo).toHaveProperty('fullName', 'facebook/react');
      expect(repo).toHaveProperty('owner', 'facebook');
      expect(repo).toHaveProperty('language', 'JavaScript');
      expect(repo).toHaveProperty('htmlUrl');
      expect(Array.isArray(repo.topics)).toBe(true);
    });

    it('currentStats にスター数・フォーク数が含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      const stats = data.currentStats;
      expect(stats).not.toBeNull();
      expect(stats).toHaveProperty('stars');
      expect(stats).toHaveProperty('forks');
      expect(stats).toHaveProperty('watchers');
      expect(stats).toHaveProperty('openIssues');
      expect(stats).toHaveProperty('snapshotDate');
    });

    it('topics が JSON 配列として正しくパースされること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1');
      expect(response.status).toBe(200);

      const data = (await response.json()) as RepoDetailResponse;
      expect(data.repository.topics).toEqual(['ui', 'javascript']);
    });
  });

  describe('バリデーション・エラー', () => {
    it('存在しない repoId を指定したら 404 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/99999');
      expect(response.status).toBe(404);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'NOT_FOUND');
    });

    it('repoId に文字列を指定したら 400 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/abc');
      expect(response.status).toBe(400);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('repoId に 0 を指定したら 400 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/0');
      expect(response.status).toBe(400);
    });
  });
});

describe('/api/repositories/:repoId/history', () => {
  describe('正常レスポンス', () => {
    it('history 配列を含む 200 レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1/history');
      expect(response.status).toBe(200);

      const data = (await response.json()) as HistoryResponse;
      expect(data).toHaveProperty('history');
      expect(Array.isArray(data.history)).toBe(true);
      expect(data.history.length).toBeGreaterThan(0);
    });

    it('history アイテムにスナップショットの必須フィールドが含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1/history');
      expect(response.status).toBe(200);

      const data = (await response.json()) as HistoryResponse;
      const item = data.history[0];
      expect(item).toHaveProperty('repoId');
      expect(item).toHaveProperty('stars');
      expect(item).toHaveProperty('forks');
      expect(item).toHaveProperty('snapshotDate');
    });

    it('history が日付の降順で返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/1/history');
      expect(response.status).toBe(200);

      const data = (await response.json()) as HistoryResponse;
      expect(data.history.length).toBeGreaterThan(1);

      for (let i = 0; i < data.history.length - 1; i++) {
        expect(data.history[i].snapshotDate >= data.history[i + 1].snapshotDate).toBe(true);
      }
    });
  });

  describe('エラー', () => {
    it('スナップショットが存在しない repoId を指定したら 404 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/99999/history');
      expect(response.status).toBe(404);

      const data = (await response.json()) as { code: string };
      expect(data).toHaveProperty('code', 'NOT_FOUND');
    });

    it('repoId に文字列を指定したら 400 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/repositories/abc/history');
      expect(response.status).toBe(400);
    });
  });
});
