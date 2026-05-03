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
import loginGithub from './routes/auth/login-github';
import callbackGithub from './routes/auth/callback-github';
import me from './routes/auth/me';
import logout from './routes/auth/logout';
import billingCheckout from './routes/billing/checkout';
import stripeWebhook from './routes/webhook/stripe';
import { dbMiddleware } from './middleware/database';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { loggingMiddleware } from './middleware/logging';
import { runDailyCollection } from './services/batch-collector';
import { runMetricsCalculation } from './services/metrics-calculator';
import { runWeeklyRankingCalculation } from './services/weekly-ranking-calculator';
import { logger } from './utils/logger';
import type { AppEnv } from './types/app';

const app = new Hono<AppEnv>();

// リクエストログミドルウェア（全ルートに適用）
app.use('/*', loggingMiddleware);

// CORS設定（環境変数で許可オリジンを制御）
// 本番環境: ALLOWED_ORIGINS環境変数を設定してオリジンを制限すること
// 開発環境: ALLOWED_ORIGINSが未設定の場合は'*'（全て許可）
app.use('/*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS?.split(',') ?? [];
  const corsMiddleware = cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true,
  });
  return corsMiddleware(c, next);
});

// レート制限ミドルウェア（100 req/min/IP）
// non-008: APIレート制限（100 req/min/IP）
// 内部バッチAPIには適用しない
app.use('/api/trends/*', rateLimitMiddleware(60 * 1000, 100));
app.use('/api/repositories/*', rateLimitMiddleware(60 * 1000, 100));
app.use('/api/languages', rateLimitMiddleware(60 * 1000, 100));
app.use('/api/auth/*', rateLimitMiddleware(60 * 1000, 100));
app.use('/api/billing/*', rateLimitMiddleware(60 * 1000, 100));

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
app.route('/api/auth/login/github', loginGithub);
app.route('/api/auth/callback/github', callbackGithub);
app.route('/api/auth/me', me);
app.route('/api/auth/logout', logout);
app.route('/api/billing/checkout', billingCheckout);
app.route('/api/webhook/stripe', stripeWebhook);
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
          const batchStart = Date.now();
          try {
            const result = await runMetricsCalculation({ db });
            logger.info('batch_completed', {
              batch: 'calculate-metrics',
              cron: event.cron,
              duration_ms: Date.now() - batchStart,
              result,
            });
          } catch (error) {
            logger.error('batch_failed', {
              batch: 'calculate-metrics',
              cron: event.cron,
              duration_ms: Date.now() - batchStart,
              error: String(error),
            });
          }
        } else if (event.cron === '0 1 * * 1') {
          // 週別ランキング集計（毎週月曜 UTC 1:00）
          const batchStart = Date.now();
          try {
            const result = await runWeeklyRankingCalculation({ db });
            logger.info('batch_completed', {
              batch: 'calculate-weekly',
              cron: event.cron,
              duration_ms: Date.now() - batchStart,
              result,
            });
          } catch (error) {
            logger.error('batch_failed', {
              batch: 'calculate-weekly',
              cron: event.cron,
              duration_ms: Date.now() - batchStart,
              error: String(error),
            });
          }
        } else {
          // 日次データ収集（UTC 0:00）
          const githubToken = env.GITHUB_TOKEN;

          if (!githubToken) {
            logger.error('batch_failed', {
              batch: 'collect-daily',
              cron: event.cron,
              error: 'GITHUB_TOKEN環境変数が設定されていません',
            });
            return;
          }

          const batchStart = Date.now();
          try {
            const result = await runDailyCollection({ db, githubToken });
            logger.info('batch_completed', {
              batch: 'collect-daily',
              cron: event.cron,
              duration_ms: Date.now() - batchStart,
              result,
            });
          } catch (error) {
            logger.error('batch_failed', {
              batch: 'collect-daily',
              cron: event.cron,
              duration_ms: Date.now() - batchStart,
              error: String(error),
            });
          }
        }
      })()
    );
  },
};
