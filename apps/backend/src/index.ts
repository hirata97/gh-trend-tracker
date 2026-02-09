import { Hono } from 'hono';
import { cors } from 'hono/cors';
import health from './routes/health';
import trendsDaily from './routes/trends-daily';
import trends from './routes/trends';
import repositories from './routes/repositories';
import languages from './routes/languages';
import { dbMiddleware } from './middleware/database';
import type { AppEnv } from './types/app';

const app = new Hono<AppEnv>();

// CORS設定（環境変数で許可オリジンを制御）
app.use('/*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') ?? [];
  const corsMiddleware = cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// データベースミドルウェア
app.use('/*', dbMiddleware);

// ルート登録
app.route('/health', health);
app.route('/api/trends/daily', trendsDaily);
app.route('/api/trends', trends);
app.route('/api/repos', repositories);
app.route('/api/languages', languages);

export default app;
