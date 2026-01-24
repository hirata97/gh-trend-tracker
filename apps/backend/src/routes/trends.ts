import { Hono } from 'hono';
import { getAllTrends } from '../shared/queries';
import { DEFAULT_TREND_LIMIT } from '../shared/constants';
import { dbError } from '../shared/errors';
import type { TrendsResponse, ApiError, TrendSortField, SortOrder } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const trends = new Hono<AppEnv>();

// クエリパラメータをパースするヘルパー
function parseQueryParams(c: { req: { query: (key: string) => string | undefined } }) {
  const q = c.req.query('q');
  const minStarsStr = c.req.query('minStars');
  const maxStarsStr = c.req.query('maxStars');
  const sort = c.req.query('sort') as TrendSortField | undefined;
  const order = c.req.query('order') as SortOrder | undefined;
  const limitStr = c.req.query('limit');

  return {
    q: q || undefined,
    minStars: minStarsStr ? parseInt(minStarsStr, 10) : undefined,
    maxStars: maxStarsStr ? parseInt(maxStarsStr, 10) : undefined,
    sort: sort && ['stars', 'growth_rate', 'weekly_growth'].includes(sort) ? sort : undefined,
    order: order && ['asc', 'desc'].includes(order) ? order : undefined,
    limit: limitStr ? Math.min(parseInt(limitStr, 10), 500) : DEFAULT_TREND_LIMIT,
  };
}

// 全言語のトレンド（検索・フィルタ・ソート対応）
trends.get('/', async (c) => {
  const db = c.get('db');

  try {
    const params = parseQueryParams(c);
    const trendsList = await getAllTrends(db, params);

    const response: TrendsResponse = {
      trends: trendsList,
      filters: {
        q: params.q,
        minStars: params.minStars,
        maxStars: params.maxStars,
        sort: params.sort,
        order: params.order,
      },
    };
    return c.json(response);
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorResponse: ApiError = dbError('Failed to fetch trends');
    return c.json(errorResponse, 500);
  }
});

// 言語別トレンド（検索・フィルタ・ソート対応）
trends.get('/:language', async (c) => {
  const language = c.req.param('language');
  const db = c.get('db');

  try {
    const params = parseQueryParams(c);
    const trendsList = await getAllTrends(db, { ...params, language });

    const response: TrendsResponse = {
      language,
      trends: trendsList,
      filters: {
        q: params.q,
        minStars: params.minStars,
        maxStars: params.maxStars,
        sort: params.sort,
        order: params.order,
      },
    };
    return c.json(response);
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorResponse: ApiError = dbError('Failed to fetch trends');
    return c.json(errorResponse, 500);
  }
});

export default trends;
