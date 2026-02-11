/**
 * GitHub OAuth認証コールバックエンドポイント
 * GET /api/auth/callback/github
 */

import { Hono } from 'hono';
import { exchangeCodeForToken, fetchGitHubUser } from '../../services/github-auth';
import { generateJwt } from '../../services/jwt';
import { upsertUser } from '../../services/user-service';
import type { AppEnv } from '../../types/app';

const callbackGithub = new Hono<AppEnv>();

/**
 * GitHub OAuth認証コールバック処理
 *
 * 1. 認証コードを受け取る
 * 2. アクセストークンに交換
 * 3. GitHubユーザー情報を取得
 * 4. DB にユーザー登録/更新
 * 5. JWT 発行
 * 6. Cookie に設定してメイン画面にリダイレクト
 */
callbackGithub.get('/', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  // 認証コードの検証
  if (!code) {
    return c.json({ error: 'Authorization code not provided' }, 400);
  }

  // State検証（CSRF対策）
  const cookieHeader = c.req.header('Cookie');
  let savedState: string | undefined;

  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const stateCookie = cookies.find((c) => c.startsWith('oauth_state='));
    if (stateCookie) {
      savedState = stateCookie.split('=')[1];
    }
  }

  if (!state || !savedState || state !== savedState) {
    return c.json({ error: 'Invalid state parameter' }, 400);
  }

  try {
    const clientId = c.env.GITHUB_CLIENT_ID;
    const clientSecret = c.env.GITHUB_CLIENT_SECRET;
    const jwtSecret = c.env.JWT_SECRET;
    const redirectUri =
      c.env.REDIRECT_URI ?? 'http://localhost:8787/api/auth/callback/github';

    if (!clientId || !clientSecret || !jwtSecret) {
      return c.json({ error: 'Server configuration error' }, 500);
    }

    // 1. トークン交換
    const accessToken = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);

    // 2. GitHubユーザー情報取得
    const githubUser = await fetchGitHubUser(accessToken);

    // 3. ユーザー登録/更新
    const db = c.get('db');
    const user = await upsertUser(
      db,
      githubUser.id,
      githubUser.login,
      githubUser.email,
      githubUser.avatar_url
    );

    // 4. JWT生成
    const jwt = await generateJwt(
      {
        userId: user.id,
        username: user.username,
      },
      jwtSecret
    );

    // 5. CookieにJWTを設定
    // 本番環境では Secure; SameSite=Strict; を使用
    c.header(
      'Set-Cookie',
      `auth_token=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
    ); // 30日

    // 6. State Cookie削除
    c.header(
      'Set-Cookie',
      'oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );

    // 7. メイン画面にリダイレクト
    // 本番環境ではフロントエンドのURLを環境変数から取得
    const frontendUrl = c.env.FRONTEND_URL ?? 'http://localhost:4321';
    return c.redirect(`${frontendUrl}/`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return c.json(
      {
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default callbackGithub;
