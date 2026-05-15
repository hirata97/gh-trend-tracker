import { SELF, env } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import type { LanguagesResponse } from '@gh-trend-tracker/shared';

beforeAll(async () => {
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
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, description, html_url, created_at, updated_at)
    VALUES (4, 'no-lang-repo', 'example/no-lang-repo', 'example', NULL, 'No language repo', 'https://github.com/example/no-lang-repo', '2024-01-01', '2024-06-01')`
    )
    .run();
});

describe('/api/languages', () => {
  describe('正常レスポンス', () => {
    it('languages 配列を含む 200 レスポンスが返されること', async () => {
      const response = await SELF.fetch('http://example.com/api/languages');
      expect(response.status).toBe(200);

      const data = (await response.json()) as LanguagesResponse;
      expect(data).toHaveProperty('languages');
      expect(Array.isArray(data.languages)).toBe(true);
    });

    it('language が NULL のリポジトリは除外されること', async () => {
      const response = await SELF.fetch('http://example.com/api/languages');
      expect(response.status).toBe(200);

      const data = (await response.json()) as LanguagesResponse;
      expect(data.languages.every((lang) => lang !== null)).toBe(true);
    });

    it('重複なしで言語一覧が返されること（TypeScript は1件のみ）', async () => {
      const response = await SELF.fetch('http://example.com/api/languages');
      expect(response.status).toBe(200);

      const data = (await response.json()) as LanguagesResponse;
      const tsCount = data.languages.filter((lang) => lang === 'TypeScript').length;
      expect(tsCount).toBe(1);
    });

    it('登録リポジトリの言語がすべて含まれること', async () => {
      const response = await SELF.fetch('http://example.com/api/languages');
      expect(response.status).toBe(200);

      const data = (await response.json()) as LanguagesResponse;
      expect(data.languages).toContain('JavaScript');
      expect(data.languages).toContain('TypeScript');
    });
  });
});
