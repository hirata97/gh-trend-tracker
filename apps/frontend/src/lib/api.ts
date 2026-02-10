/**
 * API Client for GitHub Trends Tracker
 * Fetches data from the backend API
 */

import type {
  TrendsResponse,
  TrendsQueryParams,
  TrendsDailyResponse,
  SortBy,
  LanguagesResponse,
  HistoryResponse,
  RepoDetailResponse,
} from '@gh-trend-tracker/shared';

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787';

/**
 * Fetch trending repositories with optional filters
 * @param params - Query parameters for filtering, sorting, and searching
 * @returns TrendsResponse with repository data
 */
export async function getTrends(params?: TrendsQueryParams): Promise<TrendsResponse> {
  const { language, ...queryParams } = params || {};

  // Build base URL
  const baseUrl = language
    ? `${API_BASE}/api/trends/${encodeURIComponent(language)}`
    : `${API_BASE}/api/trends`;

  // Build query string from params
  const searchParams = new URLSearchParams();
  if (queryParams.q) searchParams.set('q', queryParams.q);
  if (queryParams.minStars !== undefined)
    searchParams.set('minStars', String(queryParams.minStars));
  if (queryParams.maxStars !== undefined)
    searchParams.set('maxStars', String(queryParams.maxStars));
  if (queryParams.sort) searchParams.set('sort', queryParams.sort);
  if (queryParams.order) searchParams.set('order', queryParams.order);
  if (queryParams.limit !== undefined) searchParams.set('limit', String(queryParams.limit));

  const queryString = searchParams.toString();
  const url = queryString ? `${baseUrl}?${queryString}` : baseUrl;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch trends: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch daily trends with sort_by support
 * @param params - Query parameters for sorting and filtering
 * @returns TrendsDailyResponse with repository data and pagination
 */
export async function getTrendsDaily(params?: {
  language?: string;
  sort_by?: SortBy;
  page?: number;
  limit?: number;
}): Promise<TrendsDailyResponse> {
  const searchParams = new URLSearchParams();
  if (params?.language) searchParams.set('language', params.language);
  if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params?.page !== undefined) searchParams.set('page', String(params.page));
  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));

  const queryString = searchParams.toString();
  const url = queryString
    ? `${API_BASE}/api/trends/daily?${queryString}`
    : `${API_BASE}/api/trends/daily`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch daily trends: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch all available languages
 * @returns LanguagesResponse with list of languages
 */
export async function getLanguages(): Promise<LanguagesResponse> {
  const url = `${API_BASE}/api/languages`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch languages: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch repository history
 * @param repoId - GitHub repository ID
 * @returns HistoryResponse with snapshot data
 */
export async function getRepoHistory(repoId: number): Promise<HistoryResponse> {
  const url = `${API_BASE}/api/repos/${repoId}/history`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch repository detail
 * @param repoId - GitHub repository ID
 * @returns RepoDetailResponse with repository info and stats
 */
export async function getRepoDetail(repoId: number): Promise<RepoDetailResponse> {
  const url = `${API_BASE}/api/repos/${repoId}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch repository detail: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
