import { Hono } from 'hono';
import { getAllLanguages } from '../shared/queries';
import { dbError } from '../shared/errors';
import { logger } from '../utils/logger';
import type { LanguagesResponse, ApiError } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const languages = new Hono<AppEnv>();

// 言語一覧
languages.get('/', async (c) => {
  const db = c.get('db');

  try {
    const languagesList = await getAllLanguages(db);
    const response: LanguagesResponse = { languages: languagesList };
    return c.json(response);
  } catch (error) {
    const traceId = crypto.randomUUID();
    logger.error('languages_fetch_failed', {
      traceId,
      errorMessage: error instanceof Error ? error.message : 'unknown',
    });
    const errorResponse: ApiError = { ...dbError('Failed to fetch languages'), traceId };
    return c.json(errorResponse, 500);
  }
});

export default languages;
