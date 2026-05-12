import { Hono } from 'hono';
import * as Sentry from '@sentry/cloudflare';
import { registerMiddleware } from './middleware';
import { registerRoutes } from './routes';
import { handleScheduled } from './scheduled';
import { buildSentryOptions } from './utils/sentry';
import type { AppEnv } from './types/app';
import type { Bindings } from './types/bindings';

const app = new Hono<AppEnv>();

registerMiddleware(app);
registerRoutes(app);

export default Sentry.withSentry<Bindings>(
  (env) => buildSentryOptions(env),
  {
    fetch: app.fetch,
    async scheduled(controller: ScheduledController, env: AppEnv['Bindings'], ctx: ExecutionContext) {
      ctx.waitUntil(handleScheduled(controller, env));
    },
  },
);
