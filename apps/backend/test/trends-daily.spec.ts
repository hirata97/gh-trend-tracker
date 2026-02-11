import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  // テスト用D1にスキーマを適用（prepare/run で実行）
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

  // テストデータを挿入
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
    VALUES (1, 'react', 'facebook/react', 'facebook', 'JavaScript', 'A declarative UI library', 'https://github.com/facebook/react', '2024-01-01', '2024-06-01')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
    VALUES (2, 'vue', 'vuejs/vue', 'vuejs', 'TypeScript', 'Progressive JavaScript Framework', 'https://github.com/vuejs/vue', '2024-01-01', '2024-06-01')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
    VALUES (3, 'svelte', 'sveltejs/svelte', 'sveltejs', 'TypeScript', 'Cybernetically enhanced web apps', 'https://github.com/sveltejs/svelte', '2024-01-01', '2024-06-01')`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (1, 230000, 47000, 6700, 900, '2026-02-09')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (2, 210000, 34000, 6300, 600, '2026-02-09')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (3, 80000, 4200, 1200, 800, '2026-02-09')`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO metrics_daily (repo_id, calculated_date, stars_7d_increase, stars_30d_increase, stars_7d_rate, stars_30d_rate) VALUES (1, '2026-02-09', 500, 2000, 0.0022, 0.0088)`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO metrics_daily (repo_id, calculated_date, stars_7d_increase, stars_30d_increase, stars_7d_rate, stars_30d_rate) VALUES (2, '2026-02-09', 300, 1200, 0.0014, 0.0057)`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO metrics_daily (repo_id, calculated_date, stars_7d_increase, stars_30d_increase, stars_7d_rate, stars_30d_rate) VALUES (3, '2026-02-09', 800, 3000, 0.0101, 0.0389)`
    )
    .run();
});

describe('/api/trends/daily', () => {
  describe('バリデーション', () => {
    it('sort_byを省略したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/daily');
      expect(response.status).toBe(400);

      const data = (await response.json()) as { error: string; code: string };
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('sort_byに不正な値を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/daily?sort_by=invalid');
      expect(response.status).toBe(400);

      const data = (await response.json()) as { code: string };
      expect(data).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('pageに0を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&page=0'
      );
      expect(response.status).toBe(400);
    });

    it('limitに101を指定したら400エラーが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&limit=101'
      );
      expect(response.status).toBe(400);
    });
  });

  describe('正常レスポンス', () => {
    it('有効なsort_byを指定したらdata・pagination・metadataを含む200レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/daily?sort_by=7d_increase');
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          full_name: string;
          description: string | null;
          language: string | null;
          stargazers_count: number;
          forks_count: number;
          stars_7d_increase: number;
          stars_30d_increase: number;
          stars_7d_rate: number;
          stars_30d_rate: number;
        }>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
        metadata: { snapshot_date: string };
      };

      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pagination');
      expect(data).toHaveProperty('metadata');
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(3);
      expect(data.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
      expect(data.metadata).toHaveProperty('snapshot_date', '2026-02-09');

      const item = data.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('full_name');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('language');
      expect(item).toHaveProperty('stargazers_count');
      expect(item).toHaveProperty('forks_count');
      expect(item).toHaveProperty('stars_7d_increase');
      expect(item).toHaveProperty('stars_30d_increase');
      expect(item).toHaveProperty('stars_7d_rate');
      expect(item).toHaveProperty('stars_30d_rate');
    });

    it('sort_by=7d_increaseを指定したら7日間増加数の降順でソートされること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/daily?sort_by=7d_increase');
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<{ stars_7d_increase: number; full_name: string }>;
      };

      // svelte(800) > react(500) > vue(300) の順
      expect(data.data[0].full_name).toBe('sveltejs/svelte');
      expect(data.data[1].full_name).toBe('facebook/react');
      expect(data.data[2].full_name).toBe('vuejs/vue');
    });

    it('sort_by=total_starsを指定したら総スター数の降順でソートされること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/daily?sort_by=total_stars');
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<{ stargazers_count: number; full_name: string }>;
      };

      // react(230000) > vue(210000) > svelte(80000) の順
      expect(data.data[0].full_name).toBe('facebook/react');
      expect(data.data[1].full_name).toBe('vuejs/vue');
      expect(data.data[2].full_name).toBe('sveltejs/svelte');
    });

    it('全てのsort_by値を指定したら200が返されること', async () => {
      const sortValues = ['7d_increase', '30d_increase', '7d_rate', '30d_rate', 'total_stars'];

      for (const sortBy of sortValues) {
        const response = await SELF.fetch(`http://example.com/api/trends/daily?sort_by=${sortBy}`);
        expect(response.status).toBe(200);
      }
    });

    it('pageとlimitを省略したらデフォルト値（page=1, limit=20）が適用されること', async () => {
      const response = await SELF.fetch('http://example.com/api/trends/daily?sort_by=7d_increase');
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        pagination: { page: number; limit: number };
      };
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(20);
    });

    it('pageとlimitを指定したら指定値がpaginationに反映されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&page=1&limit=2'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<unknown>;
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(2);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.totalPages).toBe(2);
      expect(data.data.length).toBe(2);
    });

    it('languageを指定したら該当言語のリポジトリのみ返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&language=TypeScript'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<{ language: string | null }>;
        pagination: { total: number };
      };
      expect(data.pagination.total).toBe(2);
      expect(data.data.every((item) => item.language === 'TypeScript')).toBe(true);
    });
  });

  describe('ページネーション境界', () => {
    it('2ページ目を指定したら1ページ目に含まれない残りのデータが返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&page=2&limit=2'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<{ full_name: string }>;
        pagination: { page: number; total: number; totalPages: number };
      };
      expect(data.pagination.page).toBe(2);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.totalPages).toBe(2);
      // 3件中 limit=2 の2ページ目 → 残り1件（vue: 7d_increase=300 が最小）
      expect(data.data.length).toBe(1);
      expect(data.data[0].full_name).toBe('vuejs/vue');
    });

    it('データ件数を超えるページを指定したら空配列が返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&page=100&limit=20'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<unknown>;
        pagination: { page: number; total: number };
      };
      expect(data.pagination.page).toBe(100);
      expect(data.pagination.total).toBe(3);
      expect(data.data.length).toBe(0);
    });

    it('limit=1を指定したらデータが1件ずつ返されtotalPagesが正しく計算されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&limit=1'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<{ full_name: string }>;
        pagination: { limit: number; total: number; totalPages: number };
      };
      expect(data.pagination.limit).toBe(1);
      expect(data.pagination.total).toBe(3);
      expect(data.pagination.totalPages).toBe(3);
      expect(data.data.length).toBe(1);
      expect(data.data[0].full_name).toBe('sveltejs/svelte');
    });

    it('存在しない言語を指定したら空配列とtotal=0が返されること', async () => {
      const response = await SELF.fetch(
        'http://example.com/api/trends/daily?sort_by=7d_increase&language=COBOL'
      );
      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        data: Array<unknown>;
        pagination: { total: number };
      };
      expect(data.pagination.total).toBe(0);
      expect(data.data.length).toBe(0);
    });
  });

});
