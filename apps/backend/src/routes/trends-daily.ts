import { Hono } from 'hono';
import { eq, desc, and, sql } from 'drizzle-orm';
import { repositories, metricsDaily, repoSnapshots } from '../db/schema';
import { TrendsDailyQuerySchema } from '../schemas/trends';
import { validationError, dbError } from '../shared/errors';
import { cacheMiddleware } from '../middleware/cache';
import type { TrendsDailyResponse, ApiError } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const trendsDaily = new Hono<AppEnv>();

// キャッシュミドルウェアを適用（1分キャッシュ、5分stale-while-revalidate）
trendsDaily.use('/', cacheMiddleware(60, 300));

trendsDaily.get('/', async (c) => {
  const db = c.get('db');

  // クエリパラメータをパース・バリデーション
  const parsed = TrendsDailyQuerySchema.safeParse({
    language: c.req.query('language'),
    sort_by: c.req.query('sort_by'),
    page: c.req.query('page'),
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    const errorResponse: ApiError = validationError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    );
    return c.json(errorResponse, 400);
  }

  const { language, sort_by, page, limit } = parsed.data;

  try {
    // 最新の計算日付を取得
    const [latestMetric] = await db
      .select({ date: metricsDaily.calculatedDate })
      .from(metricsDaily)
      .orderBy(desc(metricsDaily.calculatedDate))
      .limit(1);

    if (!latestMetric) {
      const response: TrendsDailyResponse = {
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        metadata: { snapshot_date: new Date().toISOString().split('T')[0] },
      };
      return c.json(response);
    }

    const snapshotDate = latestMetric.date;

    // WHERE条件を構築
    const conditions = [eq(metricsDaily.calculatedDate, snapshotDate)];
    if (language) {
      conditions.push(eq(repositories.language, language));
    }

    // ソート列マッピング
    const sortColumnMap = {
      '7d_increase': metricsDaily.stars7dIncrease,
      '30d_increase': metricsDaily.stars30dIncrease,
      '7d_rate': metricsDaily.stars7dRate,
      '30d_rate': metricsDaily.stars30dRate,
      total_stars: repoSnapshots.stars,
    } as const;

    const sortColumn = sortColumnMap[sort_by];

    // 総件数を取得（メインクエリと同じ3テーブルJOINで正確にカウント）
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(metricsDaily)
      .innerJoin(repositories, eq(metricsDaily.repoId, repositories.repoId))
      .innerJoin(
        repoSnapshots,
        and(
          eq(repoSnapshots.repoId, metricsDaily.repoId),
          eq(repoSnapshots.snapshotDate, snapshotDate)
        )
      )
      .where(and(...conditions));

    const total = countResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    // メインクエリ: metrics_daily + repositories + repo_snapshots をJOIN
    const results = await db
      .select({
        repoId: repositories.repoId,
        fullName: repositories.fullName,
        description: repositories.description,
        language: repositories.language,
        forks: repoSnapshots.forks,
        stars: repoSnapshots.stars,
        stars7dIncrease: metricsDaily.stars7dIncrease,
        stars30dIncrease: metricsDaily.stars30dIncrease,
        stars7dRate: metricsDaily.stars7dRate,
        stars30dRate: metricsDaily.stars30dRate,
      })
      .from(metricsDaily)
      .innerJoin(repositories, eq(metricsDaily.repoId, repositories.repoId))
      .innerJoin(
        repoSnapshots,
        and(
          eq(repoSnapshots.repoId, metricsDaily.repoId),
          eq(repoSnapshots.snapshotDate, snapshotDate)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(sortColumn))
      .limit(limit)
      .offset(offset);

    // レスポンスをIssue仕様に合わせてマッピング
    const data = results.map((row) => ({
      id: String(row.repoId),
      full_name: row.fullName,
      description: row.description,
      language: row.language,
      stargazers_count: row.stars ?? 0,
      forks_count: row.forks ?? 0,
      stars_7d_increase: row.stars7dIncrease,
      stars_30d_increase: row.stars30dIncrease,
      stars_7d_rate: row.stars7dRate,
      stars_30d_rate: row.stars30dRate,
    }));

    const response: TrendsDailyResponse = {
      data,
      pagination: { page, limit, total, totalPages },
      metadata: { snapshot_date: snapshotDate },
    };

    return c.json(response);
  } catch (error) {
    console.error('Error fetching daily trends:', error);
    const errorResponse: ApiError = dbError('Failed to fetch daily trends');
    return c.json(errorResponse, 500);
  }
});

export default trendsDaily;
