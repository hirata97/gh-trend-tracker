import { Hono } from 'hono';
import { getRepositoryHistory, getRepositoryDetail } from '../shared/queries';
import { DEFAULT_HISTORY_DAYS } from '../shared/constants';
import { parsePositiveInt } from '../shared/utils';
import { validationError, notFoundError, dbError } from '../shared/errors';
import { cacheMiddleware } from '../middleware/cache';
import type { HistoryResponse, RepoDetailResponse, ApiError } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const repositories = new Hono<AppEnv>();

// リポジトリの詳細情報（5分キャッシュ、10分stale-while-revalidate）
repositories.use('/:repoId', cacheMiddleware(300, 600));

repositories.get('/:repoId', async (c) => {
  const repoId = parsePositiveInt(c.req.param('repoId'));

  if (repoId === null) {
    const errorResponse: ApiError = validationError('Invalid repoId: must be a positive integer');
    return c.json(errorResponse, 400);
  }

  const db = c.get('db');

  try {
    const detail = await getRepositoryDetail(db, repoId);

    if (!detail) {
      const errorResponse: ApiError = notFoundError('Repository not found');
      return c.json(errorResponse, 404);
    }

    const response: RepoDetailResponse = detail;
    return c.json(response);
  } catch (error) {
    console.error('Error fetching repository detail:', error);
    const errorResponse: ApiError = dbError('Failed to fetch repository detail');
    return c.json(errorResponse, 500);
  }
});

// リポジトリの履歴データ（5分キャッシュ、10分stale-while-revalidate）
repositories.use('/:repoId/history', cacheMiddleware(300, 600));

repositories.get('/:repoId/history', async (c) => {
  const repoId = parsePositiveInt(c.req.param('repoId'));

  if (repoId === null) {
    const errorResponse: ApiError = validationError('Invalid repoId: must be a positive integer');
    return c.json(errorResponse, 400);
  }

  const db = c.get('db');

  try {
    const history = await getRepositoryHistory(db, repoId, DEFAULT_HISTORY_DAYS);

    if (history.length === 0) {
      const errorResponse: ApiError = notFoundError('Repository not found');
      return c.json(errorResponse, 404);
    }

    const response: HistoryResponse = { history };
    return c.json(response);
  } catch (error) {
    console.error('Error fetching history:', error);
    const errorResponse: ApiError = dbError('Failed to fetch history');
    return c.json(errorResponse, 500);
  }
});

export default repositories;
