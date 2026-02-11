/**
 * 認証ミドルウェア
 */

import { createMiddleware } from 'hono/factory';
import { verifyJwt } from '../services/jwt';
import type { AppEnv } from '../types/app';
import type { JwtPayload } from '@gh-trend-tracker/shared';

/**
 * 認証済みユーザー情報を含むVariables型
 */
export type AuthVariables = {
  user: JwtPayload;
};

/**
 * JWT認証ミドルウェア
 *
 * リクエストのCookieまたはAuthorizationヘッダーからJWTを取得し、検証する。
 * 検証成功時はユーザー情報をコンテキストに設定する。
 *
 * @returns Honoミドルウェア
 */
export const authMiddleware = createMiddleware<AppEnv & { Variables: AuthVariables }>(
  async (c, next) => {
    const jwtSecret = c.env.JWT_SECRET;

    if (!jwtSecret) {
      return c.json({ error: 'Server configuration error' }, 500);
    }

    // CookieまたはAuthorizationヘッダーからJWTを取得
    let token: string | undefined;

    // 1. Cookieから取得
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map((c) => c.trim());
      const authCookie = cookies.find((c) => c.startsWith('auth_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }

    // 2. Authorizationヘッダーから取得（Bearer）
    if (!token) {
      const authHeader = c.req.header('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // JWT検証
    const result = await verifyJwt(token, jwtSecret);

    if (!result.valid) {
      return c.json({ error: `Invalid token: ${result.error}` }, 401);
    }

    // ユーザー情報をコンテキストに設定
    c.set('user', result.payload);

    await next();
  }
);
