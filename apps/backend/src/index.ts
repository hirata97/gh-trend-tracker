import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import health from './routes/health';
import trendsDaily from './routes/trends-daily';
import trendsWeekly from './routes/trends-weekly';
import trendsWeeklyAvailable from './routes/trends-weekly-available';
import repositories from './routes/repositories';
import repositoriesSearch from './routes/repositories-search';
import languages from './routes/languages';
import collectDaily from './routes/batch/collect-daily';
import calculateMetrics from './routes/batch/calculate-metrics';
import calculateWeekly from './routes/batch/calculate-weekly';
import { dbMiddleware } from './middleware/database';
import { runDailyCollection } from './services/batch-collector';
import { runMetricsCalculation } from './services/metrics-calculator';
import { runWeeklyRankingCalculation } from './services/weekly-ranking-calculator';
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
app.route('/api/trends/weekly/available-weeks', trendsWeeklyAvailable);
app.route('/api/trends/weekly', trendsWeekly);
app.route('/api/repositories/search', repositoriesSearch);
app.route('/api/repositories', repositories);
app.route('/api/languages', languages);
app.route('/api/internal/batch/collect-daily', collectDaily);
app.route('/api/internal/batch/calculate-metrics', calculateMetrics);
app.route('/api/internal/batch/calculate-weekly', calculateWeekly);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const db = drizzle(env.DB);

        if (event.cron === '30 0 * * *') {
          // メトリクス計算（UTC 0:30）
          try {
            const result = await runMetricsCalculation({ db });
            console.log('メトリクス計算結果:', JSON.stringify(result));
          } catch (error) {
            console.error('メトリクス計算エラー:', error);
          }
        } else if (event.cron === '0 1 * * 1') {
          // 週別ランキング集計（毎週月曜 UTC 1:00）
          try {
            const result = await runWeeklyRankingCalculation({ db });
            console.log('週別ランキング集計結果:', JSON.stringify(result));
          } catch (error) {
            console.error('週別ランキング集計エラー:', error);
          }
        } else {
          // 日次データ収集（UTC 0:00）
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
        }
      })()
    );
  },
};
