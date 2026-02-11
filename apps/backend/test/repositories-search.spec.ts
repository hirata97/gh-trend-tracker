import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { SearchResponse } from '@gh-trend-tracker/shared';

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

  // テストデータ挿入
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
    VALUES (3, 'typescript-react-starter', 'microsoft/typescript-react-starter', 'microsoft', 'TypeScript', 'A starter template for TypeScript and React', 'https://github.com/microsoft/typescript-react-starter', '2024-01-01', '2024-06-01')`
    )
    .run();

  // スナップショットデータ挿入（今日の日付）
  const today = new Date().toISOString().split('T')[0];
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (1, 230000, 47000, 6700, 900, ?)`
    )
    .bind(today)
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (2, 210000, 34000, 6300, 600, ?)`
    )
    .bind(today)
    .run();
  await db
    .prepare(
      `INSERT INTO repo_snapshots (repo_id, stars, forks, watchers, open_issues, snapshot_date) VALUES (3, 50000, 5000, 1000, 100, ?)`
    )
    .bind(today)
    .run();
});

describe('Repositories Search endpoint', () => {
  it('GET /api/repositories/search returns search results by full_name match', async () => {
    const response = await SELF.fetch('http://example.com/api/repositories/search?query=react');
    expect(response.status).toBe(200);

    const data = (await response.json()) as SearchResponse;
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('total');
    expect(Array.isArray(data.data)).toBe(true);

    // "react" に一致するリポジトリが返される
    expect(data.data.length).toBeGreaterThan(0);
    const reactRepo = data.data.find((repo) => repo.full_name === 'facebook/react');
    expect(reactRepo).toBeDefined();
    expect(reactRepo?.full_name).toBe('facebook/react');
    expect(reactRepo?.language).toBe('JavaScript');
  });

  it('GET /api/repositories/search returns search results by description match', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/repositories/search?query=declarative'
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as SearchResponse;
    expect(data.data.length).toBeGreaterThan(0);

    // "declarative" がdescriptionに含まれるリポジトリが返される
    const reactRepo = data.data.find((repo) => repo.full_name === 'facebook/react');
    expect(reactRepo).toBeDefined();
  });

  it('GET /api/repositories/search returns results sorted by stars descending', async () => {
    const response = await SELF.fetch('http://example.com/api/repositories/search?query=react');
    expect(response.status).toBe(200);

    const data = (await response.json()) as SearchResponse;
    expect(data.data.length).toBeGreaterThan(1);

    // スター数順にソートされているか確認
    for (let i = 0; i < data.data.length - 1; i++) {
      expect(data.data[i].stargazers_count).toBeGreaterThanOrEqual(
        data.data[i + 1].stargazers_count
      );
    }
  });

  it('GET /api/repositories/search respects limit parameter', async () => {
    const response = await SELF.fetch('http://example.com/api/repositories/search?query=react&limit=1');
    expect(response.status).toBe(200);

    const data = (await response.json()) as SearchResponse;
    expect(data.data.length).toBe(1);
  });

  it('GET /api/repositories/search returns 400 for query less than 2 characters', async () => {
    const response = await SELF.fetch('http://example.com/api/repositories/search?query=a');
    expect(response.status).toBe(400);

    const errorData = await response.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('GET /api/repositories/search returns 400 without query parameter', async () => {
    const response = await SELF.fetch('http://example.com/api/repositories/search');
    expect(response.status).toBe(400);

    const errorData = await response.json();
    expect(errorData).toHaveProperty('error');
    expect(errorData).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('GET /api/repositories/search returns empty results for non-matching query', async () => {
    const response = await SELF.fetch(
      'http://example.com/api/repositories/search?query=nonexistent123456789'
    );
    expect(response.status).toBe(200);

    const data = (await response.json()) as SearchResponse;
    expect(data.data.length).toBe(0);
    expect(data.total).toBe(0);
  });
});
