/**
 * GET /api/trends/daily の統合テスト
 * レスポンス形を assert してAPI契約の後方互換性を保証する
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

const TODAY = '2026-01-15';

async function setupTables() {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      repo_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      owner TEXT NOT NULL,
      language TEXT,
      description TEXT,
      html_url TEXT NOT NULL,
      homepage TEXT,
      topics TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      pushed_at TEXT
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS repo_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      repo_id INTEGER NOT NULL,
      stars INTEGER DEFAULT 0 NOT NULL,
      forks INTEGER DEFAULT 0 NOT NULL,
      watchers INTEGER DEFAULT 0 NOT NULL,
      open_issues INTEGER DEFAULT 0 NOT NULL,
      snapshot_date TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')) NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS metrics_daily (
      repo_id INTEGER NOT NULL,
      calculated_date TEXT NOT NULL,
      stars_7d_increase INTEGER DEFAULT 0 NOT NULL,
      stars_30d_increase INTEGER DEFAULT 0 NOT NULL,
      stars_7d_rate REAL DEFAULT 0 NOT NULL,
      stars_30d_rate REAL DEFAULT 0 NOT NULL,
      PRIMARY KEY(repo_id, calculated_date)
    )
  `).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO repositories
      (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
    VALUES
      (1001, 'test-repo', 'owner/test-repo', 'owner', 'TypeScript', 'Test repo', 'https://github.com/owner/test-repo', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
      (1002, 'other-repo', 'owner/other-repo', 'owner', 'Python', 'Other repo', 'https://github.com/owner/other-repo', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
  `).run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO repo_snapshots (repo_id, stars, forks, snapshot_date)
    VALUES
      (1001, 5000, 200, ?),
      (1002, 3000, 100, ?)
  `)
    .bind(TODAY, TODAY)
    .run();

  await env.DB.prepare(`
    INSERT OR IGNORE INTO metrics_daily
      (repo_id, calculated_date, stars_7d_increase, stars_30d_increase, stars_7d_rate, stars_30d_rate)
    VALUES
      (1001, ?, 500, 1000, 0.1, 0.25),
      (1002, ?, 200, 400, 0.07, 0.15)
  `)
    .bind(TODAY, TODAY)
    .run();
}

describe('GET /api/trends/daily', () => {
  beforeAll(setupTables);

  it('200 と正しいレスポンス形を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/trends/daily?sort_by=7d_increase');

    expect(res.status).toBe(200);
    const data = await res.json<Record<string, unknown>>();

    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
    expect(data).toHaveProperty('metadata');
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('pagination フィールドが正しい構造を持つ', async () => {
    const res = await SELF.fetch('http://example.com/api/trends/daily?sort_by=7d_increase');
    const data = await res.json<{
      pagination: Record<string, unknown>;
      metadata: Record<string, unknown>;
    }>();

    expect(data.pagination).toMatchObject({
      page: expect.any(Number),
      limit: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
    expect(data.metadata).toHaveProperty('snapshot_date');
  });

  it('各 data エントリが必須フィールドを持つ', async () => {
    const res = await SELF.fetch('http://example.com/api/trends/daily?sort_by=7d_increase');
    const data = await res.json<{ data: Record<string, unknown>[] }>();

    expect(data.data.length).toBeGreaterThan(0);
    for (const item of data.data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('full_name');
      expect(item).toHaveProperty('stargazers_count');
      expect(item).toHaveProperty('stars_7d_increase');
      expect(item).toHaveProperty('stars_30d_increase');
      expect(item).toHaveProperty('stars_7d_rate');
      expect(item).toHaveProperty('stars_30d_rate');
    }
  });

  it('language フィルタが動作する', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/daily?sort_by=7d_increase&language=TypeScript'
    );

    expect(res.status).toBe(200);
    const data = await res.json<{ data: Record<string, unknown>[] }>();
    expect(Array.isArray(data.data)).toBe(true);
    for (const item of data.data) {
      expect(item.language).toBe('TypeScript');
    }
  });

  it('無効な sort_by パラメータで 400 を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/trends/daily?sort_by=invalid');

    expect(res.status).toBe(400);
    const data = await res.json<Record<string, unknown>>();
    expect(data).toHaveProperty('error');
  });

  it('ページネーションが動作する', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/daily?sort_by=7d_increase&page=1&limit=1'
    );

    expect(res.status).toBe(200);
    const data = await res.json<{ data: unknown[]; pagination: { limit: number } }>();
    expect(data.data.length).toBeLessThanOrEqual(1);
    expect(data.pagination.limit).toBe(1);
  });
});
