import { Hono } from 'hono';
import { logger } from '../utils/logger';
import { eq, and } from 'drizzle-orm';
import { rankingWeekly } from '../db/schema';
import { WeeklyTrendsQuerySchema } from '../schemas/weekly';
import { validationError, notFoundError, dbError } from '../shared/errors';
import { cacheMiddleware } from '../middleware/cache';
import type { WeeklyTrendResponse, ApiError, WeeklyTrendItem } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const trendsWeekly = new Hono<AppEnv>();

// 週次データは一度計算されたら不変のため1時間キャッシュ、24時間stale-while-revalidate
trendsWeekly.use('/', cacheMiddleware(3600, 86400));

trendsWeekly.get('/', async (c) => {
  const db = c.get('db');

  // クエリパラメータをパース・バリデーション
  const parsed = WeeklyTrendsQuerySchema.safeParse({
    year: c.req.query('year'),
    week: c.req.query('week'),
    language: c.req.query('language'),
  });

  if (!parsed.success) {
    const errorResponse: ApiError = validationError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    );
    return c.json(errorResponse, 400);
  }

  const { year, week, language } = parsed.data;

  try {
    // WHERE条件を構築
    const conditions = [
      eq(rankingWeekly.year, year),
      eq(rankingWeekly.weekNumber, week),
      eq(rankingWeekly.language, language ?? 'all'),
    ];

    // ranking_weekly テーブルから該当週のデータを取得
    const [result] = await db
      .select({
        year: rankingWeekly.year,
        weekNumber: rankingWeekly.weekNumber,
        language: rankingWeekly.language,
        rankData: rankingWeekly.rankData,
      })
      .from(rankingWeekly)
      .where(and(...conditions))
      .limit(1);

    if (!result) {
      const errorResponse: ApiError = notFoundError(
        `No ranking data found for year=${year}, week=${week}, language=${language ?? 'all'}`
      );
      return c.json(errorResponse, 404);
    }

    // rank_data は JSON 文字列として保存されているのでパース
    const rankData = JSON.parse(result.rankData) as Array<{
      rank: number;
      repo_id: number;
      repo_full_name: string;
      star_increase: number;
    }>;

    // レスポンス形式に変換
    const ranking: WeeklyTrendItem[] = rankData.map((item) => ({
      rank: item.rank,
      repo_id: String(item.repo_id),
      repo_full_name: item.repo_full_name,
      star_increase: item.star_increase,
    }));

    const response: WeeklyTrendResponse = {
      metadata: {
        year: result.year,
        week: result.weekNumber,
        language: result.language,
      },
      ranking,
    };

    return c.json(response);
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('trends_weekly_fetch_failed', {
      traceId,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    const errorResponse: ApiError = { ...dbError('Failed to fetch weekly trends'), traceId };
    return c.json(errorResponse, 500);
  }
});

export default trendsWeekly;
