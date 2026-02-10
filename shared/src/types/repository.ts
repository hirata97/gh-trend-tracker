/**
 * リポジトリ関連の型定義
 */

// Repository型（データベーススキーマから派生）
export interface Repository {
  repoId: number;
  name: string;
  fullName: string;
  owner: string;
  language: string | null;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  topics: string | null; // JSON文字列
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

// Snapshot型
export interface RepoSnapshot {
  id: number;
  repoId: number;
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  snapshotDate: string; // ISO date: "2026-01-12"
  createdAt: string;
}

/**
 * 日次メトリクス型（API wire format: snake_case）
 *
 * Note: apps/backend/src/db/schema.ts にも同名の Drizzle ORM 推論型が存在するが、
 * そちらは camelCase（例: stars7dIncrease）。この型は API レスポンス用。
 */
export interface MetricsDaily {
  repo_id: number;
  calculated_date: string;
  stars_7d_increase: number;
  stars_30d_increase: number;
  stars_7d_rate: number;
  stars_30d_rate: number;
}

/**
 * 言語型（API wire format: snake_case）
 *
 * Note: apps/backend/src/db/schema.ts にも同名の Drizzle ORM 推論型が存在するが、
 * そちらは camelCase（例: nameJa, sortOrder）。この型は API レスポンス用。
 */
export interface Language {
  code: string;
  name_ja: string;
  sort_order: number;
}
