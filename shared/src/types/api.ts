/**
 * API レスポンス・リクエスト関連の型定義
 */

import type { RepoSnapshot } from './repository';

// トレンドアイテム型
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

// trends/daily用ソートオプション
export type SortBy = '7d_increase' | '30d_increase' | '7d_rate' | '30d_rate' | 'total_stars';

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

// /api/trends/daily レスポンス型
export interface TrendsDailyItem {
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
}

export interface TrendsDailyPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** TrendsDailyPaginationの汎用エイリアス */
export type PaginationMeta = TrendsDailyPagination;

export interface TrendsDailyResponse {
  data: TrendsDailyItem[];
  pagination: TrendsDailyPagination;
  metadata: {
    snapshot_date: string;
  };
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
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'DB_ERROR'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED';

export interface ApiError {
  /** エラーメッセージ */
  error: string;
  /** エラーコード（オプション） */
  code?: ErrorCode;
  /** トレース用ID（デバッグ用、オプション） */
  traceId?: string;
}

/** バッチ収集レスポンス型 */
export interface BatchCollectResponse {
  message: string;
  summary: {
    total: number;
    githubFetchSuccess: number;
    githubNotFound: number;
    githubErrors: number;
    dbUpdateSuccess: number;
    dbUpdateErrors: number;
  };
  snapshotDate: string;
  durationMs: number;
}

/** メトリクス計算バッチレスポンス型 */
export interface BatchMetricsResponse {
  message: string;
  summary: {
    /** 処理対象リポジトリ数 */
    total: number;
    /** メトリクス計算成功数 */
    success: number;
    /** スナップショットなしでスキップされた数 */
    skipped: number;
    /** エラー数 */
    errors: number;
  };
  calculatedDate: string;
  durationMs: number;
}

/** 週別ランキングのランクエントリ */
export interface WeeklyRankEntry {
  rank: number;
  repo_id: number;
  repo_full_name: string;
  star_increase: number;
}

/** 週別トレンド集計バッチレスポンス型 */
export interface BatchWeeklyRankingResponse {
  message: string;
  summary: {
    /** 生成されたランキング数（言語別） */
    totalRankings: number;
    /** 集計対象リポジトリ数 */
    totalRepos: number;
  };
  year: number;
  weekNumber: number;
  durationMs: number;
}

/** 検索結果アイテム型 */
export interface SearchResultItem {
  id: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
}

/** 検索APIレスポンス型 */
export interface SearchResponse {
  data: SearchResultItem[];
  total: number;
}

/** 週別トレンドランキングアイテム型（bac-004用） */
export interface WeeklyTrendItem {
  rank: number;
  repo_id: string;
  repo_full_name: string;
  star_increase: number;
}

/** 週別トレンドランキングレスポンス型（bac-004） */
export interface WeeklyTrendResponse {
  metadata: {
    year: number;
    week: number;
    language: string;
  };
  ranking: WeeklyTrendItem[];
}

/** 利用可能週の情報型 */
export interface AvailableWeek {
  year: number;
  week: number;
}

/** 利用可能週リストレスポンス型（bac-005） */
export interface AvailableWeeksResponse {
  weeks: AvailableWeek[];
}
