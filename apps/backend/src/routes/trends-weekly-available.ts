import { Hono } from 'hono';
import { logger } from '../utils/logger';
import { sql } from 'drizzle-orm';
import { rankingWeekly } from '../db/schema';
import { dbError } from '../shared/errors';
import { cacheMiddleware } from '../middleware/cache';
import type { AvailableWeeksResponse, ApiError, AvailableWeek } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const trendsWeeklyAvailable = new Hono<AppEnv>();

// 利用可能週リストは週1回更新のため1時間キャッシュ、24時間stale-while-revalidate
trendsWeeklyAvailable.use('/', cacheMiddleware(3600, 86400));

trendsWeeklyAvailable.get('/', async (c) => {
  const db = c.get('db');

  try {
    // ranking_weekly テーブルから集計済みの (year, week_number) のユニークなリストを取得
    // 最新の週から降順で返す
    const results = await db
      .select({
        year: rankingWeekly.year,
        weekNumber: rankingWeekly.weekNumber,
      })
      .from(rankingWeekly)
      .groupBy(rankingWeekly.year, rankingWeekly.weekNumber)
      .orderBy(sql`${rankingWeekly.year} DESC, ${rankingWeekly.weekNumber} DESC`);

    const weeks: AvailableWeek[] = results.map((row) => ({
      year: row.year,
      week: row.weekNumber,
    }));

    const response: AvailableWeeksResponse = {
      weeks,
    };

    return c.json(response);
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('trends_weekly_available_fetch_failed', {
      traceId,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    const errorResponse: ApiError = { ...dbError('Failed to fetch available weeks'), traceId };
    return c.json(errorResponse, 500);
  }
});

export default trendsWeeklyAvailable;
