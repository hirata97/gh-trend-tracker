/**
 * OpenAPI仕様を含むHonoアプリケーション
 */
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/d1';
import type { Bindings } from '../types/bindings';

import {
  healthRoute,
  getAllTrendsRoute,
  getTrendsByLanguageRoute,
  getRepositoryHistoryRoute,
  getLanguagesRoute,
} from './index';

import { getAllTrends, getTrendsByLanguage, getRepositoryHistory, getAllLanguages } from '../shared/queries';
import { DEFAULT_TREND_LIMIT, DEFAULT_HISTORY_DAYS } from '../shared/constants';
import { parsePositiveInt } from '../shared/utils';

import type { HealthResponse, TrendsResponse, HistoryResponse, LanguagesResponse, ErrorResponse } from '@gh-trend-tracker/shared-types';

const app = new OpenAPIHono<{ Bindings: Bindings }>();

// CORS設定
app.use('/*', cors());

// ヘルスチェック
app.openapi(healthRoute, (c) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  return c.json(response, 200);
});

// 全言語のトレンド
app.openapi(getAllTrendsRoute, async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const trendsList = await getAllTrends(db, DEFAULT_TREND_LIMIT);
    const response: TrendsResponse = { trends: trendsList };
    return c.json(response, 200);
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch trends' };
    return c.json(errorResponse, 500);
  }
});

// 言語別トレンド
app.openapi(getTrendsByLanguageRoute, async (c) => {
  const { language } = c.req.valid('param');
  const db = drizzle(c.env.DB);

  try {
    const trendsList = await getTrendsByLanguage(db, language, DEFAULT_TREND_LIMIT);
    const response: TrendsResponse = { language, trends: trendsList };
    return c.json(response, 200);
  } catch (error) {
    console.error('Error fetching trends:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch trends' };
    return c.json(errorResponse, 500);
  }
});

// リポジトリ履歴
app.openapi(getRepositoryHistoryRoute, async (c) => {
  const { repoId: repoIdParam } = c.req.valid('param');
  const repoId = parsePositiveInt(repoIdParam);

  if (repoId === null) {
    const errorResponse: ErrorResponse = { error: 'Invalid repoId: must be a positive integer' };
    return c.json(errorResponse, 400);
  }

  const db = drizzle(c.env.DB);

  try {
    const history = await getRepositoryHistory(db, repoId, DEFAULT_HISTORY_DAYS);

    if (history.length === 0) {
      const errorResponse: ErrorResponse = { error: 'Repository not found' };
      return c.json(errorResponse, 404);
    }

    const response: HistoryResponse = { history };
    return c.json(response, 200);
  } catch (error) {
    console.error('Error fetching history:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch history' };
    return c.json(errorResponse, 500);
  }
});

// 言語一覧
app.openapi(getLanguagesRoute, async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const languagesList = await getAllLanguages(db);
    const response: LanguagesResponse = { languages: languagesList };
    return c.json(response, 200);
  } catch (error) {
    console.error('Error fetching languages:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch languages' };
    return c.json(errorResponse, 500);
  }
});

// OpenAPI仕様書エンドポイント
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'GitHub Trend Tracker API',
    version: '1.0.0',
    description: 'GitHubリポジトリのトレンドを取得するAPI',
    contact: {
      name: 'GitHub Trend Tracker',
      url: 'https://github.com/hirata97/gh-trend-tracker',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'https://gh-trend-tracker.{user}.workers.dev',
      description: 'Production server',
    },
    {
      url: 'http://localhost:8787',
      description: 'Local development server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'ヘルスチェックエンドポイント',
    },
    {
      name: 'Trends',
      description: 'トレンドリポジトリ取得エンドポイント',
    },
    {
      name: 'Repositories',
      description: 'リポジトリ情報取得エンドポイント',
    },
    {
      name: 'Languages',
      description: '言語一覧取得エンドポイント',
    },
  ],
});

export default app;
