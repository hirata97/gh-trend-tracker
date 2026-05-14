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
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, html_url, created_at, updated_at) VALUES (101, 'react', 'facebook/react', 'facebook', 'JavaScript', 'https://github.com/facebook/react', '2024-01-01', '2024-06-01')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, html_url, created_at, updated_at) VALUES (102, 'typescript', 'microsoft/typescript', 'microsoft', 'TypeScript', 'https://github.com/microsoft/typescript', '2024-01-01', '2024-06-01')`
    )
    .run();
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, html_url, created_at, updated_at) VALUES (103, 'vue', 'vuejs/vue', 'vuejs', 'TypeScript', 'https://github.com/vuejs/vue', '2024-01-01', '2024-06-01')`
    )
    .run();
  // language が NULL のリポジトリ（言語一覧には含まれない）
  await db
    .prepare(
      `INSERT INTO repositories (repo_id, name, full_name, owner, language, html_url, created_at, updated_at) VALUES (104, 'dotfiles', 'user/dotfiles', 'user', NULL, 'https://github.com/user/dotfiles', '2024-01-01', '2024-06-01')`
    )
    .run();
});

describe('/api/languages', () => {
  it('languagesフィールドを含む200レスポンスが返されること', async () => {
    const response = await SELF.fetch('http://example.com/api/languages');
    expect(response.status).toBe(200);

    const data = (await response.json()) as LanguagesResponse;

    expect(data).toHaveProperty('languages');
    expect(Array.isArray(data.languages)).toBe(true);
  });

  it('NULLの言語が除外されること', async () => {
    const response = await SELF.fetch('http://example.com/api/languages');
    expect(response.status).toBe(200);

    const data = (await response.json()) as LanguagesResponse;
    expect(data.languages.every((l) => l !== null)).toBe(true);
  });

  it('重複する言語が1件にまとめられること', async () => {
    const response = await SELF.fetch('http://example.com/api/languages');
    expect(response.status).toBe(200);

    const data = (await response.json()) as LanguagesResponse;
    const uniqueLanguages = new Set(data.languages);
    expect(data.languages.length).toBe(uniqueLanguages.size);
  });

  it('期待する言語が含まれること', async () => {
    const response = await SELF.fetch('http://example.com/api/languages');
    expect(response.status).toBe(200);

    const data = (await response.json()) as LanguagesResponse;
    expect(data.languages).toContain('JavaScript');
    expect(data.languages).toContain('TypeScript');
  });
});
