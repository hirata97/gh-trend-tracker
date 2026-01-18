import { Hono } from 'hono';
import { getTrendsByLanguage, getAllTrends } from '../shared/queries';
import { DEFAULT_TREND_LIMIT } from '../shared/constants';
import type { TrendsResponse, ErrorResponse } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const trends = new Hono<AppEnv>();

// 全言語のトレンド
trends.get('/', async (c) => {
  const db = c.get('db');

  try {
    const trendsList = await getAllTrends(db, DEFAULT_TREND_LIMIT);
    const response: TrendsResponse = { trends: trendsList };
    return c.json(response);
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch trends' };
    return c.json(errorResponse, 500);
  }
});

// 言語別トレンド
trends.get('/:language', async (c) => {
  const language = c.req.param('language');
  const db = c.get('db');

  try {
    const trendsList = await getTrendsByLanguage(db, language, DEFAULT_TREND_LIMIT);
    const response: TrendsResponse = { language, trends: trendsList };
    return c.json(response);
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch trends' };
    return c.json(errorResponse, 500);
  }
});

export default trends;
