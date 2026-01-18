import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { getAllLanguages } from '../shared/queries';
import type { LanguagesResponse, ErrorResponse } from '@gh-trend-tracker/shared';
import type { Bindings } from '../types/bindings';

const languages = new Hono<{ Bindings: Bindings }>();

// 言語一覧
languages.get('/', async (c) => {
  const db = drizzle(c.env.DB);

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
