/**
 * GET /api/trends/weekly/available-weeks の統合テスト
 * レスポンス形を assert してAPI契約の後方互換性を保証する
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { env, SELF } from 'cloudflare:test';

describe('GET /api/trends/weekly/available-weeks', () => {
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

    await env.DB.prepare(`
      INSERT OR IGNORE INTO ranking_weekly (year, week_number, language, rank_data)
      VALUES
        (2026, 3, 'all', '[]'),
        (2026, 2, 'all', '[]'),
        (2026, 3, 'TypeScript', '[]')
    `).run();
  });

  it('200 と正しいレスポンス形を返す', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );

    expect(res.status).toBe(200);
    const data = await res.json<Record<string, unknown>>();

    expect(data).toHaveProperty('weeks');
    expect(Array.isArray(data.weeks)).toBe(true);
  });

  it('各 week エントリが year と week フィールドを持つ', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );
    const data = await res.json<{ weeks: Record<string, unknown>[] }>();

    expect(data.weeks.length).toBeGreaterThan(0);
    for (const week of data.weeks) {
      expect(week).toHaveProperty('year');
      expect(week).toHaveProperty('week');
      expect(typeof week.year).toBe('number');
      expect(typeof week.week).toBe('number');
    }
  });

  it('重複なしで (year, week) のユニークな組み合わせを返す', async () => {
    const res = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );
    const data = await res.json<{ weeks: { year: number; week: number }[] }>();

    const unique = new Set(data.weeks.map((w) => `${w.year}-${w.week}`));
    expect(unique.size).toBe(data.weeks.length);
  });
});
