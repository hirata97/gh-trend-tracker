import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { WeeklyTrendResponse, AvailableWeeksResponse } from '@gh-trend-tracker/shared';

beforeAll(async () => {
  const db = env.DB as D1Database;

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS ranking_weekly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    language TEXT NOT NULL DEFAULT 'all',
    rank_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`
    )
    .run();

  const rankData = JSON.stringify([
    { rank: 1, repo_id: 1, repo_full_name: 'facebook/react', star_increase: 800 },
    { rank: 2, repo_id: 2, repo_full_name: 'vuejs/vue', star_increase: 600 },
    { rank: 3, repo_id: 3, repo_full_name: 'sveltejs/svelte', star_increase: 400 },
  ]);

  await db
    .prepare(
      `INSERT INTO ranking_weekly (year, week_number, language, rank_data)
    VALUES (2026, 6, 'all', ?)`
    )
    .bind(rankData)
    .run();

  await db
    .prepare(
      `INSERT INTO ranking_weekly (year, week_number, language, rank_data)
    VALUES (2026, 6, 'TypeScript', ?)`
    )
    .bind(JSON.stringify([{ rank: 1, repo_id: 2, repo_full_name: 'vuejs/vue', star_increase: 600 }]))
    .run();

  await db
    .prepare(
      `INSERT INTO ranking_weekly (year, week_number, language, rank_data)
    VALUES (2026, 5, 'all', ?)`
    )
    .bind(JSON.stringify([{ rank: 1, repo_id: 1, repo_full_name: 'facebook/react', star_increase: 700 }]))
    .run();
});

describe('/api/trends/weekly', () => {
  describe('正常レスポンス', () => {
    it('metadata・ranking を含む 200 レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?year=2026&week=6');
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('ranking');
      expect(Array.isArray(data.ranking)).toBe(true);
    });

    it('metadata に year・week・language が含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?year=2026&week=6');
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      expect(data.metadata).toHaveProperty('year', 2026);
      expect(data.metadata).toHaveProperty('week', 6);
      expect(data.metadata).toHaveProperty('language', 'all');
    });

    it('ranking アイテムに rank・repo_id・repo_full_name・star_increase が含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?year=2026&week=6');
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      expect(data.ranking.length).toBe(3);

      const item = data.ranking[0];
      expect(item).toHaveProperty('rank', 1);
      expect(item).toHaveProperty('repo_id');
      expect(item).toHaveProperty('repo_full_name', 'facebook/react');
      expect(item).toHaveProperty('star_increase', 800);
    });

    it('language パラメータを指定したら該当言語のランキングが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=6&language=TypeScript'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      expect(data.metadata.language).toBe('TypeScript');
      expect(data.ranking.length).toBe(1);
      expect(data.ranking[0].repo_full_name).toBe('vuejs/vue');
    });
  });

  describe('バリデーション・エラー', () => {
    it('year を省略したら 400 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?week=6');
      expect(response.status).toBe(400);

      const data = (await response.json()) as { code: string };
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('week を省略したら 400 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?year=2026');
      expect(response.status).toBe(400);

      const data = (await response.json()) as { code: string };
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('データが存在しない week を指定したら 404 が返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?year=2026&week=52');
      expect(response.status).toBe(404);

      const data = (await response.json()) as { code: string };
      expect(data).toHaveProperty('code', 'NOT_FOUND');
    });
  });
});

describe('/api/trends/weekly-available', () => {
  describe('正常レスポンス', () => {
    it('weeks 配列を含む 200 レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly/available-weeks');
      expect(response.status).toBe(200);

      const data = (await response.json()) as AvailableWeeksResponse;
      expect(data).toHaveProperty('weeks');
      expect(Array.isArray(data.weeks)).toBe(true);
    });

    it('weeks アイテムに year・week が含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly/available-weeks');
      expect(response.status).toBe(200);

      const data = (await response.json()) as AvailableWeeksResponse;
      expect(data.weeks.length).toBeGreaterThan(0);

      const item = data.weeks[0];
      expect(item).toHaveProperty('year');
      expect(item).toHaveProperty('week');
      expect(typeof item.year).toBe('number');
      expect(typeof item.week).toBe('number');
    });

    it('重複なし（同一 year/week の複数 language は1件に集約）で返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly/available-weeks');
      expect(response.status).toBe(200);

      const data = (await response.json()) as AvailableWeeksResponse;
      // year=2026,week=6 は all と TypeScript の2レコードあるが、集約後は1件
      const week6 = data.weeks.filter((w) => w.year === 2026 && w.week === 6);
      expect(week6.length).toBe(1);
    });

    it('最新週から降順で返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly/available-weeks');
      expect(response.status).toBe(200);

      const data = (await response.json()) as AvailableWeeksResponse;
      expect(data.weeks.length).toBeGreaterThan(1);

      // 最初のアイテムが week=6、次が week=5
      expect(data.weeks[0].week).toBe(6);
      expect(data.weeks[1].week).toBe(5);
    });
  });
});
