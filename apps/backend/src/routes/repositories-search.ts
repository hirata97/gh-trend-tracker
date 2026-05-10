import { Hono } from 'hono';
import { logger } from '../utils/logger';
import { like, or, desc, sql } from 'drizzle-orm';
import { repositories, repoSnapshots } from '../db/schema';
import { SearchQuerySchema } from '../schemas/search';
import { validationError, dbError } from '../shared/errors';
import { getTodayISO } from '../shared/utils';
import { cacheMiddleware } from '../middleware/cache';
import type { SearchResponse, ApiError } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const repositoriesSearch = new Hono<AppEnv>();

// 検索結果は同一クエリの重複リクエスト緩和のため1分キャッシュ、2分stale-while-revalidate
repositoriesSearch.use('/', cacheMiddleware(60, 120));

repositoriesSearch.get('/', async (c) => {
  const db = c.get('db');

  // クエリパラメータをパース・バリデーション
  const parsed = SearchQuerySchema.safeParse({
    query: c.req.query('query'),
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    const errorResponse: ApiError = validationError(
      parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    );
    return c.json(errorResponse, 400);
  }

  const { query: searchQuery, limit } = parsed.data;

  try {
    // 検索パターン（部分一致用）
    // SQLインジェクション対策: LIKE特殊文字（%、_）をエスケープ
    const escapedQuery = searchQuery.replace(/[%_]/g, '\\$&');
    const pattern = `%${escapedQuery}%`;

    // 最新のスナップショット日付を取得
    const snapshotDate = getTodayISO();

    // 検索クエリ: full_name または description に部分一致
    // スター数順にソートし、最新のスナップショットからスター数を取得
    const results = await db
      .select({
        repoId: repositories.repoId,
        fullName: repositories.fullName,
        description: repositories.description,
        language: repositories.language,
        stars: repoSnapshots.stars,
      })
      .from(repositories)
      .leftJoin(repoSnapshots, sql`${repositories.repoId} = ${repoSnapshots.repoId} AND ${repoSnapshots.snapshotDate} = ${snapshotDate}`)
      .where(or(like(repositories.fullName, pattern), like(repositories.description, pattern)))
      .orderBy(desc(repoSnapshots.stars))
      .limit(limit);

    // レスポンスをマッピング
    const data = results.map((row) => ({
      id: String(row.repoId),
      full_name: row.fullName,
      description: row.description,
      language: row.language,
      stargazers_count: row.stars ?? 0,
    }));

    const response: SearchResponse = {
      data,
      total: data.length,
    };

    return c.json(response);
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('repositories_search_failed', {
      traceId,
      searchQuery,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    const errorResponse: ApiError = { ...dbError('Failed to search repositories'), traceId };
    return c.json(errorResponse, 500);
  }
});

export default repositoriesSearch;
