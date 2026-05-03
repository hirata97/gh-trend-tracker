/**
 * リクエスト/レスポンスのログミドルウェア
 * 各APIリクエストの処理時間・ステータスを構造化ログとして出力する
 */
import { createMiddleware } from 'hono/factory';
import { logger } from '../utils/logger';
import type { AppEnv } from '../types/app';

export const loggingMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  await next();

  const duration_ms = Date.now() - start;
  const status = c.res.status;

  if (status >= 500) {
    logger.error('api_request', { method, path, status, duration_ms });
  } else if (status >= 400) {
    logger.warn('api_request', { method, path, status, duration_ms });
  } else {
    logger.info('api_request', { method, path, status, duration_ms });
  }
});
