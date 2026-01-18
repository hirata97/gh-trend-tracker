/**
 * GitHub API Client
 * Fetches trending repositories using GitHub REST API
 */

import { RateLimiter } from './rate-limiter.js';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  language: string | null;
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

interface SearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private token: string;
  private rateLimiter: RateLimiter;

  constructor(token: string, requestsPerMinute: number = 30) {
    if (!token) {
      throw new Error('GitHub token is required');
    }
    this.token = token;
    this.rateLimiter = new RateLimiter(requestsPerMinute);
  }

  /**
   * Fetch trending repositories for a specific language
   * Uses search API with created date filter and star sorting
   *
   * @param language - Programming language to filter by
   * @param perPage - Number of results per page (max 100)
   * @param createdAfter - Only include repos created after this date (YYYY-MM-DD)
   * @returns Array of repository objects
   */
  async fetchTrendingRepos(
    language: string,
    perPage: number = 50,
    createdAfter?: string
  ): Promise<GitHubRepo[]> {
    // Default to repos created in the last month
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() - 1);
    const createdDate = createdAfter || defaultDate.toISOString().split('T')[0];

    // Build search query
    const query = `language:${language} created:>${createdDate}`;
    const params = new URLSearchParams({
      q: query,
      sort: 'stars',
      order: 'desc',
      per_page: perPage.toString(),
    });

    const url = `${this.baseUrl}/search/repositories?${params.toString()}`;

    // Throttle to respect rate limits
    await this.rateLimiter.throttle();

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`GitHub API error (${response.status}): ${errorBody}`);
        }

        const data: SearchResponse = await response.json();
        return data.items;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `[Attempt ${attempt}/${maxRetries}] Error fetching ${language} repos:`,
          error instanceof Error ? error.message : error
        );

        // Exponential backoff: wait 2^attempt seconds
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${backoffMs / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to fetch ${language} repos after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Fetch trending repos for multiple languages
   *
   * @param languages - Array of programming languages
   * @param perPage - Number of repos per language
   * @returns Map of language to array of repos
   */
  async fetchMultipleLanguages(
    languages: string[],
    perPage: number = 50
  ): Promise<Map<string, GitHubRepo[]>> {
    const results = new Map<string, GitHubRepo[]>();

    for (const language of languages) {
      try {
        console.log(`Fetching ${language} repositories...`);
        const repos = await this.fetchTrendingRepos(language, perPage);
        results.set(language, repos);
        console.log(`✓ Fetched ${repos.length} ${language} repos`);
      } catch (error) {
        console.error(`✗ Failed to fetch ${language} repos:`, error);
        results.set(language, []); // Store empty array for failed languages
      }
    }

    return results;
  }
}
