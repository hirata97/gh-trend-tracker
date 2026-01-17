import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { getRepositoryHistory } from '../shared/queries';
import { DEFAULT_HISTORY_DAYS } from '../shared/constants';
import type { HistoryResponse, ErrorResponse } from '@gh-trend-tracker/shared-types';

type Bindings = {
  DB: D1Database;
};

const repositories = new Hono<{ Bindings: Bindings }>();

// リポジトリの履歴データ
repositories.get('/:repoId/history', async (c) => {
  const repoId = parseInt(c.req.param('repoId'));
  const db = drizzle(c.env.DB);

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
