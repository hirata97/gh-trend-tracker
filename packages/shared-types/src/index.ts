/**
 * API/Frontend間で共有される型定義
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

// APIレスポンス型
export interface TrendItem {
  repoId: number;
  name: string;
  fullName: string;
  owner: string;
  language: string | null;
  description: string | null;
  htmlUrl: string;
  currentStars: number;
  snapshotDate?: string;
}

export interface TrendsResponse {
  language?: string;
  trends: TrendItem[];
}

export interface HistoryResponse {
  history: RepoSnapshot[];
}

export interface LanguagesResponse {
  languages: (string | null)[];
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
}
