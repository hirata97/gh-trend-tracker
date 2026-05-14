import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { WeeklyTrendResponse, AvailableWeeksResponse, ApiError } from '@gh-trend-tracker/shared';

const SAMPLE_RANK_DATA = JSON.stringify([
  { rank: 1, repo_id: 1, repo_full_name: 'facebook/react', star_increase: 500 },
  { rank: 2, repo_id: 2, repo_full_name: 'vuejs/vue', star_increase: 300 },
]);

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

  // 2026年第5週 全言語
  await db
    .prepare(
      `INSERT INTO ranking_weekly (year, week_number, language, rank_data) VALUES (2026, 5, 'all', ?)`
    )
    .bind(SAMPLE_RANK_DATA)
    .run();

  // 2026年第5週 TypeScript
  await db
    .prepare(
      `INSERT INTO ranking_weekly (year, week_number, language, rank_data) VALUES (2026, 5, 'TypeScript', ?)`
    )
    .bind(SAMPLE_RANK_DATA)
    .run();

  // 2026年第4週 全言語
  await db
    .prepare(
      `INSERT INTO ranking_weekly (year, week_number, language, rank_data) VALUES (2026, 4, 'all', ?)`
    )
    .bind(SAMPLE_RANK_DATA)
    .run();
});

describe('/api/trends/weekly', () => {
  describe('バリデーション', () => {
    it('yearとweekを省略したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly');
      expect(response.status).toBe(400);

      const data = (await response.json()) as ApiError;
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('weekのみ省略したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/weekly?year=2026');
      expect(response.status).toBe(400);
    });

    it('weekに0を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=0'
      );
      expect(response.status).toBe(400);
    });

    it('weekに54を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=54'
      );
      expect(response.status).toBe(400);
    });
  });

  describe('正常レスポンス', () => {
    it('有効なyear・weekを指定したらmetadata・rankingを含む200レスポンスが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=5'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;

      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('ranking');
      expect(Array.isArray(data.ranking)).toBe(true);
    });

    it('metadataに正しいyear・week・languageが含まれること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=5'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      expect(data.metadata).toEqual({ year: 2026, week: 5, language: 'all' });
    });

    it('languageを指定したら該当言語のランキングが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=5&language=TypeScript'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      expect(data.metadata.language).toBe('TypeScript');
    });

    it('rankingの各アイテムにrank・repo_id・repo_full_name・star_increaseが含まれること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=5'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      const item = data.ranking[0];

      expect(item).toHaveProperty('rank', 1);
      expect(item).toHaveProperty('repo_id');
      expect(typeof item.repo_id).toBe('string');
      expect(item).toHaveProperty('repo_full_name', 'facebook/react');
      expect(item).toHaveProperty('star_increase', 500);
    });

    it('repo_idが文字列として返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=5'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as WeeklyTrendResponse;
      data.ranking.forEach((item) => {
        expect(typeof item.repo_id).toBe('string');
      });
    });
  });

  describe('404', () => {
    it('存在しない週を指定したら404エラーが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2025&week=1'
      );
      expect(response.status).toBe(404);

      const data = (await response.json()) as ApiError;
      expect(data).toHaveProperty('code', 'NOT_FOUND');
    });

    it('存在しない言語を指定したら404エラーが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/weekly?year=2026&week=5&language=COBOL'
      );
      expect(response.status).toBe(404);
    });
  });
});

describe('/api/trends/weekly/available-weeks', () => {
  it('weeksフィールドを含む200レスポンスが返されること', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as AvailableWeeksResponse;

    expect(data).toHaveProperty('weeks');
    expect(Array.isArray(data.weeks)).toBe(true);
  });

  it('各週アイテムにyearとweekが含まれること', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as AvailableWeeksResponse;
    expect(data.weeks.length).toBeGreaterThan(0);

    const item = data.weeks[0];
    expect(item).toHaveProperty('year');
    expect(item).toHaveProperty('week');
    expect(typeof item.year).toBe('number');
    expect(typeof item.week).toBe('number');
  });

  it('週リストが新しい順（降順）で返されること', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as AvailableWeeksResponse;
    // 2026年第5週が先頭、2026年第4週が後
    expect(data.weeks[0]).toEqual({ year: 2026, week: 5 });
    expect(data.weeks[1]).toEqual({ year: 2026, week: 4 });
  });

  it('languageが異なる場合でも同一週は1件のみ返されること', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/trends/weekly/available-weeks'
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as AvailableWeeksResponse;
    // year=2026, week=5 は 'all' と 'TypeScript' の2レコードあるが available-weeks では1件
    const week5Entries = data.weeks.filter((w) => w.year === 2026 && w.week === 5);
    expect(week5Entries.length).toBe(1);
  });
});
