/**
 * 内部API認証ミドルウェア
 * X-Internal-Tokenヘッダーによるバッチエンドポイントの認証を行う
 */
import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../types/bindings';
import type { Variables } from './database';
import { unauthorizedError } from '../shared/errors';

export const internalAuthMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const token = c.req.header('X-Internal-Token');
  const expectedToken = c.env.INTERNAL_API_TOKEN;

  if (!expectedToken) {
    console.error('INTERNAL_API_TOKEN環境変数が設定されていません');
    return c.json(unauthorizedError('Internal authentication not configured'), 500);
  }

  if (!token || token !== expectedToken) {
    return c.json(unauthorizedError('Invalid or missing internal token'), 401);
  }

  await next();
});
