/**
 * API Client for GitHub Trends Tracker
 * Fetches data from the backend API
 */

import type {
  TrendsDailyResponse,
  SortBy,
  LanguagesResponse,
  HistoryResponse,
  RepoDetailResponse,
  SearchResponse,
  WeeklyTrendResponse,
  AvailableWeeksResponse,
} from '@gh-trend-tracker/shared';

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8787';

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

/**
 * Search repositories by name or description
 * @param query - Search query string (minimum 2 characters)
 * @param limit - Maximum number of results to return
 * @returns SearchResponse with matching repositories
 */
export async function searchRepositories(
  query: string,
  limit?: number
): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('query', query);
  if (limit !== undefined) searchParams.set('limit', String(limit));

  const url = `${API_BASE}/api/repositories/search?${searchParams.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to search repositories: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch weekly trend ranking
 * @param year - ISO year
 * @param week - ISO week number (1-53)
 * @param language - Optional language filter
 * @returns WeeklyTrendResponse with ranking data
 */
export async function getWeeklyTrends(
  year: number,
  week: number,
  language?: string
): Promise<WeeklyTrendResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('year', String(year));
  searchParams.set('week', String(week));
  if (language) searchParams.set('language', language);

  const url = `${API_BASE}/api/trends/weekly?${searchParams.toString()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch weekly trends: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch available weeks list
 * @returns AvailableWeeksResponse with list of available weeks
 */
export async function getAvailableWeeks(): Promise<AvailableWeeksResponse> {
  const url = `${API_BASE}/api/trends/weekly/available-weeks`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch available weeks: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
