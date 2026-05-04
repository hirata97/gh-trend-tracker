import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import { dbMiddleware } from './database';
import { rateLimitMiddleware } from './rate-limit';
import { loggingMiddleware } from './logging';
import type { AppEnv } from '../types/app';

export function registerMiddleware(app: Hono<AppEnv>): void {
  app.use('/*', loggingMiddleware);

  // 本番環境: ALLOWED_ORIGINS環境変数を設定してオリジンを制限すること
  app.use('/*', async (c, next) => {
    const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') ?? [];
    const corsMiddleware = cors({
      origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
      credentials: true,
    });
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
