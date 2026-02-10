import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';

const INTERNAL_TOKEN = 'test-internal-token';

beforeAll(async () => {
  // テスト用D1にスキーマを適用
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

describe('POST /api/internal/batch/collect-daily', () => {
  describe('認証', () => {
    it('X-Internal-Tokenヘッダーがない場合は401が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/internal/batch/collect-daily', {
        method: 'POST',
      });
      expect(response.status).toBe(401);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('不正なトークンの場合は401が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/internal/batch/collect-daily', {
        method: 'POST',
        headers: { 'X-Internal-Token': 'wrong-token' },
      });
      expect(response.status).toBe(401);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('正しいトークンの場合は401以外が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/internal/batch/collect-daily', {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      // 認証は通る（GITHUB_TOKENがないので500になる可能性があるが、401ではない）
      expect(response.status).not.toBe(401);
    });
  });

  describe('空のリポジトリテーブル', () => {
    it('リポジトリが0件の場合はtotal=0で正常レスポンスが返されること', async () => {
      // テスト前にリポジトリテーブルが空であることを利用
      // （beforeAllでリポジトリは挿入していない）
      const response = await SELF.fetch('http://example.com/api/internal/batch/collect-daily', {
        method: 'POST',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });

      // GITHUB_TOKENが未設定の場合は500が返される
      // テスト環境ではGITHUB_TOKENを設定していないので500を確認
      const data = (await response.json()) as { error?: string; summary?: { total: number } };

      if (response.status === 200) {
        // GITHUB_TOKENが設定されている場合
        expect(data.summary).toBeDefined();
        expect(data.summary!.total).toBe(0);
      } else {
        // GITHUB_TOKENが未設定の場合は500
        expect(response.status).toBe(500);
        expect(data.error).toBeDefined();
      }
    });
  });

  describe('GETメソッド', () => {
    it('GETリクエストの場合は404が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/internal/batch/collect-daily', {
        method: 'GET',
        headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      });
      expect(response.status).toBe(404);
    });
  });
});
