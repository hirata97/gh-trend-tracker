import { Hono } from 'hono';
import type { HealthResponse } from '@gh-trend-tracker/shared-types';
import type { Bindings } from '../types/bindings';

const health = new Hono<{ Bindings: Bindings }>();

health.get('/', (c) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  return c.json(response);
});

export default health;
