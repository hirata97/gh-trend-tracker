/**
 * GET /api/languages の統合テスト
 * レスポンス形を assert してAPI契約の後方互換性を保証する
 *
 * 注: getAllLanguages は repositories テーブルから DISTINCT language を取得する
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('GET /api/languages', () => {
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
      INSERT OR IGNORE INTO repositories
        (repo_id, name, full_name, owner, language, html_url, created_at, updated_at)
      VALUES
        (4001, 'ts-repo', 'org/ts-repo', 'org', 'TypeScript', 'https://github.com/org/ts-repo', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
        (4002, 'py-repo', 'org/py-repo', 'org', 'Python', 'https://github.com/org/py-repo', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
        (4003, 'go-repo', 'org/go-repo', 'org', 'Go', 'https://github.com/org/go-repo', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')
    `).run();
  });

  it('200 と languages 配列を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/languages');

    expect(res.status).toBe(200);
    const data = await res.json<{ languages: unknown[] }>();

    expect(data).toHaveProperty('languages');
    expect(Array.isArray(data.languages)).toBe(true);
  });

  it('languages が文字列の配列である', async () => {
    const res = await SELF.fetch('http://example.com/api/languages');
    const data = await res.json<{ languages: unknown[] }>();

    expect(data.languages.length).toBeGreaterThan(0);
    for (const lang of data.languages) {
      expect(typeof lang).toBe('string');
    }
  });
});
