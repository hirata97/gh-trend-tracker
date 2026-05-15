/**
 * GET /api/repositories/search の統合テスト
 * レスポンス形を assert してAPI契約の後方互換性を保証する
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

const TODAY = new Date().toISOString().split('T')[0];

describe('GET /api/repositories/search', () => {
  beforeAll(async () => {
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
      INSERT OR IGNORE INTO repositories
        (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
      VALUES
        (2001, 'awesome-tool', 'dev/awesome-tool', 'dev', 'TypeScript', 'Awesome tool description', 'https://github.com/dev/awesome-tool', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `).run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO repo_snapshots (repo_id, stars, snapshot_date)
      VALUES (2001, 8000, ?)
    `)
      .bind(TODAY)
      .run();
  });

  it('200 と正しいレスポンス形を返す', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/repositories/search?query=awesome'
    );

    expect(res.status).toBe(200);
    const data = await res.json<Record<string, unknown>>();

    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('各 data エントリが必須フィールドを持つ', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/repositories/search?query=awesome'
    );
    const data = await res.json<{ data: Record<string, unknown>[] }>();

    expect(data.data.length).toBeGreaterThan(0);
    for (const item of data.data) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('full_name');
      expect(item).toHaveProperty('stargazers_count');
    }
  });

  it('クエリ文字列なしで 400 を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/repositories/search');

    expect(res.status).toBe(400);
    const data = await res.json<Record<string, unknown>>();
    expect(data).toHaveProperty('error');
  });

  it('1文字以下のクエリで 400 を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/repositories/search?query=a');

    expect(res.status).toBe(400);
    const data = await res.json<Record<string, unknown>>();
    expect(data).toHaveProperty('error');
  });

  it('マッチしないクエリは空の data を返す', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/repositories/search?query=xyzzy_nonexistent_12345'
    );

    expect(res.status).toBe(200);
    const data = await res.json<{ data: unknown[]; total: number }>();
    expect(data.data).toHaveLength(0);
    expect(data.total).toBe(0);
  });
});
