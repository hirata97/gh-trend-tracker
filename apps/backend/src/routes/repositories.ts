import { Hono } from 'hono';
import { getRepositoryHistory } from '../shared/queries';
import { DEFAULT_HISTORY_DAYS } from '../shared/constants';
import { parsePositiveInt } from '../shared/utils';
import type { HistoryResponse, ErrorResponse } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const repositories = new Hono<AppEnv>();

// リポジトリの履歴データ
repositories.get('/:repoId/history', async (c) => {
  const repoId = parsePositiveInt(c.req.param('repoId'));

  if (repoId === null) {
    const errorResponse: ErrorResponse = { error: 'Invalid repoId: must be a positive integer' };
    return c.json(errorResponse, 400);
  }

  const db = c.get('db');

  try {
    const history = await getRepositoryHistory(db, repoId, DEFAULT_HISTORY_DAYS);

    if (history.length === 0) {
      const errorResponse: ErrorResponse = { error: 'Repository not found' };
      return c.json(errorResponse, 404);
    }

    const response: HistoryResponse = { history };
    return c.json(response);
  } catch (error) {
    console.error('Error fetching history:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch history' };
    return c.json(errorResponse, 500);
  }
});

export default repositories;
