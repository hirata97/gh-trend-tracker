/**
 * GitHub API サービス（Cloudflare Workers互換）
 * 個別リポジトリの最新データを取得する
 */

/** GitHub APIから返されるリポジトリデータ */
export interface GitHubRepoData {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
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

/** 個別リポジトリ取得の結果 */
export type FetchResult =
  | { status: 'success'; data: GitHubRepoData }
  | { status: 'not_found'; fullName: string }
  | { status: 'error'; fullName: string; message: string };

/** バッチ取得の集計結果 */
export interface BatchFetchSummary {
  total: number;
  success: number;
  notFound: number;
  errors: number;
  results: FetchResult[];
}

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_RETRIES = 3;

/**
 * 単一リポジトリのデータを取得（リトライ付き）
 */
export async function fetchRepository(
  fullName: string,
  token: string
): Promise<FetchResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${fullName}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'gh-trend-tracker',
        },
      });

      // 二次レート制限（429 または Retry-After付き403）: 指定時間待機してリトライ
      if (response.status === 429 || (response.status === 403 && response.headers.get('retry-after'))) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter ? Math.min(Number(retryAfter) * 1000, 60000) : 60000;
        // 並列リクエストのサンダリングハードを避けるためjitterを追加
        const jitteredWait = waitMs + Math.random() * 1000;
        console.warn(`二次レート制限到達: ${fullName}, ${jitteredWait.toFixed(0)}ms待機`);
        await new Promise((resolve) => setTimeout(resolve, jitteredWait));
        continue;
      }

      // 一次レート制限（x-ratelimit-remaining=0 の403）: リセット時間まで待機してリトライ
      if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        if (remaining === '0') {
          const resetTime = Number(response.headers.get('x-ratelimit-reset')) * 1000;
          const waitMs = Math.max(resetTime - Date.now(), 1000);
          // Workers制限を考慮し最大60秒まで待機。並列リクエストのサンダリングハードを避けるためjitterを追加
          const cappedWait = Math.min(waitMs, 60000) + Math.random() * 1000;
          console.warn(`一次レート制限到達: ${fullName}, ${cappedWait.toFixed(0)}ms待機`);
          await new Promise((resolve) => setTimeout(resolve, cappedWait));
          continue;
        }
      }

      // 404: リポジトリが削除/リネームされた
      if (response.status === 404) {
        console.warn(`リポジトリが見つかりません: ${fullName}`);
        return { status: 'not_found', fullName };
      }

      // 5xx: サーバーエラー → リトライ
      if (response.status >= 500) {
        if (attempt < MAX_RETRIES) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.warn(`GitHub API 5xx (${response.status}): ${fullName}, ${backoffMs}ms後にリトライ`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }
        return {
          status: 'error',
          fullName,
          message: `GitHub API server error: ${response.status}`,
        };
      }

      // その他の非2xxレスポンス
      if (!response.ok) {
        return {
          status: 'error',
          fullName,
          message: `GitHub API error: ${response.status}`,
        };
      }

      const data: GitHubRepoData = await response.json();
      return { status: 'success', data };
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        console.warn(`取得エラー: ${fullName}, ${backoffMs}ms後にリトライ (${attempt}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        continue;
      }
      return {
        status: 'error',
        fullName,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { status: 'error', fullName, message: 'リトライ回数超過' };
}

// GitHub 二次レート制限（同時リクエスト上限100）を考慮した並列数
const FETCH_CONCURRENCY = 10;
// チャンク間インターバル: 10並列 ÷ 700ms ≈ 14.3 req/s（GitHub推奨15/s以下を維持）
const CHUNK_INTERVAL_MS = 700;

/**
 * 複数リポジトリを並列取得する
 * 同時 FETCH_CONCURRENCY 件ずつ処理し、チャンク間に CHUNK_INTERVAL_MS のインターバルを設けて
 * GitHub二次レート制限（推奨15 req/s以下）に収める
 */
export async function fetchRepositories(
  fullNames: string[],
  token: string
): Promise<BatchFetchSummary> {
  const summary: BatchFetchSummary = {
    total: fullNames.length,
    success: 0,
    notFound: 0,
    errors: 0,
    results: [],
  };

  for (let i = 0; i < fullNames.length; i += FETCH_CONCURRENCY) {
    const chunkStart = Date.now();
    const chunk = fullNames.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.all(chunk.map((name) => fetchRepository(name, token)));

    for (const result of results) {
      summary.results.push(result);

      switch (result.status) {
        case 'success':
          summary.success++;
          break;
        case 'not_found':
          summary.notFound++;
          break;
        case 'error':
          summary.errors++;
          console.error(`リポジトリ取得エラー: ${result.fullName} - ${result.message}`);
          break;
      }
    }

    // 最後のチャンク以外はインターバルを挿入（fetch時間を差し引いた残り時間だけ待機）
    if (i + FETCH_CONCURRENCY < fullNames.length) {
      const elapsed = Date.now() - chunkStart;
      const remaining = Math.max(0, CHUNK_INTERVAL_MS - elapsed);
      if (remaining > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      }
    }
  }

  return summary;
}
