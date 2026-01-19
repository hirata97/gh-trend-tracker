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
  currentStars: number | null; // LEFT JOINでスナップショットがない場合はnull
  snapshotDate?: string | null;
  weeklyGrowth: number | null; // 過去7日間のスター増加数
  weeklyGrowthRate: number | null; // 増加率（%）
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
  status: 'ok' | 'unhealthy';
  timestamp: string;
  database: 'connected' | 'disconnected';
}

export interface ErrorResponse {
  error: string;
}

/**
 * API エラーレスポンス型（OpenAPI準拠）
 *
 * エラーコード一覧:
 * - VALIDATION_ERROR: 入力バリデーションエラー
 * - NOT_FOUND: リソースが見つからない
 * - DB_ERROR: データベースエラー
 * - INTERNAL_ERROR: 内部サーバーエラー
 */
export type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'DB_ERROR' | 'INTERNAL_ERROR';

export interface ApiError {
  /** エラーメッセージ */
  error: string;
  /** エラーコード（オプション） */
  code?: ErrorCode;
  /** トレース用ID（デバッグ用、オプション） */
  traceId?: string;
}
