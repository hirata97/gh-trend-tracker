import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import { dbMiddleware } from './database';
import { rateLimitMiddleware } from './rate-limit';
import { loggingMiddleware } from './logging';
import type { AppEnv } from '../types/app';

export function registerMiddleware(app: Hono<AppEnv>): void {
  app.use('/*', loggingMiddleware);

  app.use('/*', async (c, next) => {
    const isProduction = c.env.ENVIRONMENT === 'production';
    const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];

    // 本番環境でALLOWED_ORIGINS未設定の場合はfail-closed（全オリジン拒否）
    let origin: string | string[];
    if (isProduction && allowedOrigins.length === 0) {
      origin = [];
    } else if (allowedOrigins.length > 0) {
      origin = allowedOrigins;
    } else {
      origin = '*';
    }

    const corsMiddleware = cors({ origin, credentials: true });
    return corsMiddleware(c, next);
  });

  // non-008: APIレート制限（100 req/min/IP）、内部バッチAPIには適用しない
  app.use('/api/trends/*', rateLimitMiddleware(60 * 1000, 100));
  app.use('/api/repositories/*', rateLimitMiddleware(60 * 1000, 100));
  app.use('/api/languages', rateLimitMiddleware(60 * 1000, 100));
  app.use('/api/auth/*', rateLimitMiddleware(60 * 1000, 100));
  app.use('/api/billing/*', rateLimitMiddleware(60 * 1000, 100));

  app.use('/*', dbMiddleware);
}
