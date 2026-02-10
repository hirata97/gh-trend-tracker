import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import health from './routes/health';
import trendsDaily from './routes/trends-daily';
import trends from './routes/trends';
import repositories from './routes/repositories';
import languages from './routes/languages';
import collectDaily from './routes/batch/collect-daily';
import { dbMiddleware } from './middleware/database';
import { runDailyCollection } from './services/batch-collector';
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
app.route('/api/internal/batch/collect-daily', collectDaily);

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: AppEnv['Bindings'],
    ctx: ExecutionContext
  ) {
    // Cronトリガー: 全リポジトリを処理（limit なし、タイムアウト15分）
    ctx.waitUntil(
      (async () => {
        const db = drizzle(env.DB);
        const githubToken = env.GITHUB_TOKEN;

        if (!githubToken) {
          console.error('GITHUB_TOKEN環境変数が設定されていません');
          return;
        }

        try {
          const result = await runDailyCollection({ db, githubToken });
          console.log('スケジュール実行結果:', JSON.stringify(result));
        } catch (error) {
          console.error('スケジュール実行エラー:', error);
        }
      })()
    );
  },
};
