/**
 * 週別トレンド集計バッチエンドポイント
 * POST /api/internal/batch/calculate-weekly
 *
 * 過去1週間のスター増加数に基づき、全言語＋言語別のランキングを生成し
 * ranking_weekly テーブルに保存する
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../types/app';
import type { ApiError } from '@gh-trend-tracker/shared';
import { internalAuthMiddleware } from '../../middleware/internal-auth';
import { internalError } from '../../shared/errors';
import { logger } from '../../utils/logger';
import { runWeeklyRankingCalculation } from '../../services/weekly-ranking-calculator';

const calculateWeekly = new Hono<AppEnv>();

// 内部認証ミドルウェアを適用
calculateWeekly.use('/*', internalAuthMiddleware);

calculateWeekly.post('/', async (c) => {
  const db = c.get('db');

  try {
    const response = await runWeeklyRankingCalculation({ db });
    return c.json(response);
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('batch_calculate_weekly_failed', {
      traceId,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    const errorResponse: ApiError = { ...internalError('Weekly ranking calculation failed'), traceId };
    return c.json(errorResponse, 500);
  }
});

export default calculateWeekly;
