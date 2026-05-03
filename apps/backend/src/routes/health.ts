import { Hono } from 'hono';
import { sql } from 'drizzle-orm';
import type { HealthResponse } from '@gh-trend-tracker/shared';
import type { AppEnv } from '../types/app';

const health = new Hono<AppEnv>();

health.get('/', async (c) => {
  const timestamp = new Date().toISOString();

  try {
    const db = c.get('db');
    const dbStart = Date.now();
    // 軽量なクエリでDB接続確認
    await db.run(sql`SELECT 1`);
    const dbLatency_ms = Date.now() - dbStart;

    const response: HealthResponse = {
      status: 'ok',
      timestamp,
      database: 'connected',
      dbLatency_ms,
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
