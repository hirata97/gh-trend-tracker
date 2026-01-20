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

// 検索・フィルタ・ソートのパラメータ型
export type TrendSortField = 'stars' | 'growth_rate' | 'weekly_growth';
export type SortOrder = 'asc' | 'desc';

export interface TrendsQueryParams {
  /** 言語フィルタ */
  language?: string;
  /** テキスト検索（リポジトリ名、説明文、オーナー名） */
  q?: string;
  /** 最小スター数 */
  minStars?: number;
  /** 最大スター数 */
  maxStars?: number;
  /** ソートフィールド */
  sort?: TrendSortField;
  /** ソート順序 */
  order?: SortOrder;
  /** 取得件数 */
  limit?: number;
}

export interface TrendsResponse {
  language?: string;
  trends: TrendItem[];
  /** 適用されたフィルタ情報 */
  filters?: {
    q?: string;
    minStars?: number;
    maxStars?: number;
    sort?: TrendSortField;
    order?: SortOrder;
  };
}

export interface HistoryResponse {
  history: RepoSnapshot[];
}

// リポジトリ詳細レスポンス型
export interface RepoDetailResponse {
  repository: {
    repoId: number;
    name: string;
    fullName: string;
    owner: string;
    language: string | null;
    description: string | null;
    htmlUrl: string;
    homepage: string | null;
    topics: string[];
  };
  currentStats: {
    stars: number;
    forks: number;
    watchers: number;
    openIssues: number;
    snapshotDate: string;
  } | null;
  weeklyGrowth: number | null;
  weeklyGrowthRate: number | null;
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
