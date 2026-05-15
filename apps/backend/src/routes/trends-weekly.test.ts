/**
 * GET /api/trends/weekly の統合テスト
 * レスポンス形を assert してAPI契約の後方互換性を保証する
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('GET /api/trends/weekly', () => {
  beforeAll(async () => {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS ranking_weekly (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        year INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        language TEXT DEFAULT 'all' NOT NULL,
        rank_data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      )
    `).run();

    const rankData = JSON.stringify([
      {
        rank: 1,
        repo_id: 3001,
        repo_full_name: 'org/weekly-top-repo',
        star_increase: 1200,
      },
    ]);

    await env.DB.prepare(`
      INSERT OR IGNORE INTO ranking_weekly (year, week_number, language, rank_data)
      VALUES (2026, 2, 'all', ?)
    `)
      .bind(rankData)
      .run();
  });

  it('200 と正しいレスポンス形を返す', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/weekly?year=2026&week=2'
    );

    expect(res.status).toBe(200);
    const data = await res.json<Record<string, unknown>>();

    expect(data).toHaveProperty('metadata');
    expect(data).toHaveProperty('ranking');
    expect(Array.isArray(data.ranking)).toBe(true);

    const metadata = data.metadata as Record<string, unknown>;
    expect(metadata).toHaveProperty('year');
    expect(metadata).toHaveProperty('week');
    expect(metadata).toHaveProperty('language');
  });

  it('各 ranking エントリが必須フィールドを持つ', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/weekly?year=2026&week=2'
    );
    const data = await res.json<{ ranking: Record<string, unknown>[] }>();

    expect(data.ranking.length).toBeGreaterThan(0);
    for (const item of data.ranking) {
      expect(item).toHaveProperty('rank');
      expect(item).toHaveProperty('repo_id');
      expect(item).toHaveProperty('repo_full_name');
      expect(item).toHaveProperty('star_increase');
    }
  });

  it('データが存在しない週は 404 を返す', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/weekly?year=2020&week=1'
    );

    expect(res.status).toBe(404);
    const data = await res.json<Record<string, unknown>>();
    expect(data).toHaveProperty('error');
  });

  it('必須パラメータ欠如で 400 を返す', async () => {
    const res = await SELF.fetch('http://example.com/api/trends/weekly?year=2026');

    expect(res.status).toBe(400);
    const data = await res.json<Record<string, unknown>>();
    expect(data).toHaveProperty('error');
  });
});
