import { Hono } from 'hono';
import { getAllLanguages } from '../shared/queries';
import type { LanguagesResponse, ErrorResponse } from '@gh-trend-tracker/shared';
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
    console.error('Error fetching languages:', error);
    const errorResponse: ErrorResponse = { error: 'Failed to fetch languages' };
    return c.json(errorResponse, 500);
  }
});

export default languages;
