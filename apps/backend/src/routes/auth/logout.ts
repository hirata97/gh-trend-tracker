/**
 * POST /api/auth/logout
 * ログアウト処理（Cookie削除）
 * Related: fun-030 (GitHub OAuth認証)
 */

import { Hono } from 'hono';
import { deleteCookie } from 'hono/cookie';
import type { AppEnv } from '../../types/app';

const app = new Hono<AppEnv>();

/**
 * ログアウト処理
 * auth_token Cookieを削除する
 */
app.post('/', async (c) => {
  // auth_token Cookieを削除
  deleteCookie(c, 'auth_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
  });

  return c.json({ message: 'Logged out successfully' });
});

export default app;
