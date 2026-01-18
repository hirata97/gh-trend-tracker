/**
 * API Client for GitHub Trends Tracker
 * Fetches data from the backend API
 */

import type {
  TrendsResponse,
  LanguagesResponse,
  HistoryResponse,
} from '@gh-trend-tracker/shared';

const API_BASE =
  import.meta.env.PUBLIC_API_URL || 'http://localhost:8787';

/**
 * Fetch trending repositories
 * @param language - Optional language filter
 * @returns TrendsResponse with repository data
 */
export async function getTrends(
  language?: string
): Promise<TrendsResponse> {
  const url = language
    ? `${API_BASE}/api/trends/${encodeURIComponent(language)}`
    : `${API_BASE}/api/trends`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch trends: ${response.status} ${response.statusText}`
    );
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
    throw new Error(
      `Failed to fetch languages: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch repository history
 * @param repoId - GitHub repository ID
 * @returns HistoryResponse with snapshot data
 */
export async function getRepoHistory(
  repoId: number
): Promise<HistoryResponse> {
  const url = `${API_BASE}/api/repos/${repoId}/history`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch history: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
