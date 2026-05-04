import type { Hono } from 'hono';
import health from './health';
import trendsDaily from './trends-daily';
import trendsWeekly from './trends-weekly';
import trendsWeeklyAvailable from './trends-weekly-available';
import repositories from './repositories';
import repositoriesSearch from './repositories-search';
import languages from './languages';
import collectDaily from './batch/collect-daily';
import calculateMetrics from './batch/calculate-metrics';
import calculateWeekly from './batch/calculate-weekly';
import loginGithub from './auth/login-github';
import callbackGithub from './auth/callback-github';
import me from './auth/me';
import logout from './auth/logout';
import billingCheckout from './billing/checkout';
import stripeWebhook from './webhook/stripe';
import docs from './docs';
import type { AppEnv } from '../types/app';

export function registerRoutes(app: Hono<AppEnv>): void {
  app.route('/docs', docs);
  app.route('/health', health);
  app.route('/api/trends/daily', trendsDaily);
  app.route('/api/trends/weekly/available-weeks', trendsWeeklyAvailable);
  app.route('/api/trends/weekly', trendsWeekly);
  app.route('/api/repositories/search', repositoriesSearch);
  app.route('/api/repositories', repositories);
  app.route('/api/languages', languages);
  app.route('/api/auth/login/github', loginGithub);
  app.route('/api/auth/callback/github', callbackGithub);
  app.route('/api/auth/me', me);
  app.route('/api/auth/logout', logout);
  app.route('/api/billing/checkout', billingCheckout);
  app.route('/api/webhook/stripe', stripeWebhook);
  app.route('/api/internal/batch/collect-daily', collectDaily);
  app.route('/api/internal/batch/calculate-metrics', calculateMetrics);
  app.route('/api/internal/batch/calculate-weekly', calculateWeekly);
}
