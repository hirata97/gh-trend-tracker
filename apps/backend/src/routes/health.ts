import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import type { HealthResponse } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const health = new Hono<AppEnv>();

health.get('/', async (c) => {
  const timestamp = new Date().toISOString();

  try {
    const db = c.get('db');
    // 軽量なクエリでDB接続確認
    await db.run(sql`SELECT 1`);

    const response: HealthResponse = {
      status: 'ok',
      timestamp,
      database: 'connected',
    };
    return c.json(response);
  } catch (error) {
    console.error('Health check failed - database connection error:', error);
    const response: HealthResponse = {
      status: 'unhealthy',
      timestamp,
      database: 'disconnected',
    };
    return c.json(response, 503);
  }
});

export default health;
