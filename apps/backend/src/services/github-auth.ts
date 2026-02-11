/**
 * GitHub OAuth認証サービス
 */

import type { GitHubTokenResponse, GitHubUser } from '@gh-trend-tracker/shared';

/**
 * GitHub OAuth認証URLを生成する
 *
 * @param clientId - GitHub OAuth App Client ID
 * @param redirectUri - コールバックURL
 * @param state - CSRF保護用のランダム文字列
 * @returns GitHub OAuth認証URL
 */
export function generateAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * GitHub認証コードをアクセストークンに交換する
 *
 * @param code - GitHubから受け取った認証コード
 * @param clientId - GitHub OAuth App Client ID
 * @param clientSecret - GitHub OAuth App Client Secret
 * @param redirectUri - コールバックURL
 * @returns アクセストークン
 * @throws GitHubトークン交換エラー
 */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.statusText}`);
  }

  const data = (await response.json()) as GitHubTokenResponse;

  if (!data.access_token) {
    throw new Error('No access token received from GitHub');
  }

  return data.access_token;
}

/**
 * GitHubアクセストークンを使用してユーザー情報を取得する
 *
 * @param accessToken - GitHubアクセストークン
 * @returns GitHubユーザー情報
 * @throws GitHubユーザー情報取得エラー
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub user fetch failed: ${response.statusText}`);
  }

  const user = (await response.json()) as GitHubUser;

  return user;
}

/**
 * ランダムなstate文字列を生成する（CSRF対策）
 *
 * @returns ランダムなstate文字列
 */
export function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
