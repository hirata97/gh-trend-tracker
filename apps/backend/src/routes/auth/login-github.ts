/**
 * GitHub OAuth認証開始エンドポイント
 * GET /api/auth/login/github
 */

import { Hono } from 'hono';
import { generateAuthUrl, generateState } from '../../services/github-auth';
import type { AppEnv } from '../../types/app';

const loginGithub = new Hono<AppEnv>();

/**
 * GitHub OAuth認証ページにリダイレクトする
 */
loginGithub.get('/', async (c) => {
  const clientId = c.env.GITHUB_CLIENT_ID;
  const redirectUri =
    c.env.REDIRECT_URI ?? 'http://localhost:8787/api/auth/callback/github';

  if (!clientId) {
    return c.json({ error: 'GitHub Client ID not configured' }, 500);
  }

  // CSRFトークン生成
  const state = generateState();

  // GitHub OAuth URLを生成
  const authUrl = generateAuthUrl(clientId, redirectUri, state);

  // StateをCookieに保存（CSRF対策）
  c.header(
    'Set-Cookie',
    `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
  );

  // GitHub認証ページにリダイレクト
  return c.redirect(authUrl);
});

export default loginGithub;
