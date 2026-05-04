/**
 * メトリクス計算バッチエンドポイント
 * POST /api/internal/batch/calculate-metrics
 *
 * 本日のスナップショットがあるリポジトリについて、
 * 7日間/30日間のスター増加数・増加率を計算し metrics_daily テーブルに保存する
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../types/app';
import type { ApiError } from '@gh-trend-tracker/shared';
import { internalAuthMiddleware } from '../../middleware/internal-auth';
import { internalError } from '../../shared/errors';
import { logger } from '../../utils/logger';
import { runMetricsCalculation } from '../../services/metrics-calculator';

const calculateMetrics = new Hono<AppEnv>();

// 内部認証ミドルウェアを適用
calculateMetrics.use('/*', internalAuthMiddleware);

calculateMetrics.post('/', async (c) => {
  const db = c.get('db');

  try {
    const response = await runMetricsCalculation({ db });
    return c.json(response);
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('batch_calculate_metrics_failed', {
      traceId,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    const errorResponse: ApiError = { ...internalError('Metrics calculation failed'), traceId };
    return c.json(errorResponse, 500);
  }
});

export default calculateMetrics;
