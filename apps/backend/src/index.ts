import { Hono } from 'hono';
import { registerMiddleware } from './middleware';
import { registerRoutes } from './routes';
import { handleScheduled } from './scheduled';
import type { AppEnv } from './types/app';

const app = new Hono<AppEnv>();

registerMiddleware(app);
registerRoutes(app);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(handleScheduled(event, env));
  },
};
