import { drizzle } from 'drizzle-orm/d1';
import { runDailyCollection } from './services/batch-collector';
import { runMetricsCalculation } from './services/metrics-calculator';
import { runWeeklyRankingCalculation } from './services/weekly-ranking-calculator';
import { logger } from './utils/logger';
import type { AppEnv } from './types/app';

export async function handleScheduled(
  event: ScheduledController,
  env: AppEnv['Bindings'],
): Promise<void> {
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
}
